"""Tasks Celery do app integracoes (sincronização com o Google Calendar)."""

from celery import shared_task
from django_tenants.utils import schema_context


@shared_task(autoretry_for=(Exception,), max_retries=3, default_retry_delay=60, retry_backoff=True)
def sincronizar_evento_google(schema_name, consulta_id):
    """Sincroniza a consulta com o Google Calendar dentro do schema do tenant."""
    from apps.tenants.models import Clinica
    clinica = Clinica.objects.filter(schema_name=schema_name).first()
    if clinica and hasattr(clinica, "recurso_habilitado") and not clinica.recurso_habilitado("google_calendar"):
        return None

    from apps.agenda.models import Consulta
    from apps.integracoes.google_calendar import sincronizar_consulta

    with schema_context(schema_name):
        consulta = Consulta.objects.filter(pk=consulta_id).first()
        if not consulta:
            return None
        evento = sincronizar_consulta(consulta)
        return evento.google_event_id


@shared_task(autoretry_for=(Exception,), max_retries=3, default_retry_delay=60, retry_backoff=True)
def remover_evento_google(schema_name, consulta_id):
    """Remove do Google o evento de uma consulta cancelada (dentro do schema)."""
    from apps.tenants.models import Clinica
    clinica = Clinica.objects.filter(schema_name=schema_name).first()
    if clinica and hasattr(clinica, "recurso_habilitado") and not clinica.recurso_habilitado("google_calendar"):
        return False

    from apps.agenda.models import Consulta
    from apps.integracoes.google_calendar import remover_evento

    with schema_context(schema_name):
        consulta = Consulta.objects.filter(pk=consulta_id).first()
        if consulta is not None:
            return remover_evento(consulta)
    return False


@shared_task
def remover_evento_google_direto(schema_name, dentista_id, calendar_id, event_id):
    """Remove um evento do Google pelo ID quando a consulta JÁ foi excluída
    (não há mais a linha para consultar) — evita eventos órfãos na agenda."""
    from apps.tenants.models import Clinica
    clinica = Clinica.objects.filter(schema_name=schema_name).first()
    if clinica and hasattr(clinica, "recurso_habilitado") and not clinica.recurso_habilitado("google_calendar"):
        return False

    from apps.integracoes.google_calendar import remover_evento_por_id

    with schema_context(schema_name):
        return remover_evento_por_id(dentista_id, calendar_id, event_id)


@shared_task
def reconciliar_google(schema_name):
    """Reconcilia (por ID) todas as consultas do tenant com o Google. Retorna
    as contagens {criados, atualizados, removidos, canceladas} (para o toast)."""
    from apps.tenants.models import Clinica
    clinica = Clinica.objects.filter(schema_name=schema_name).first()
    if clinica and hasattr(clinica, "recurso_habilitado") and not clinica.recurso_habilitado("google_calendar"):
        return {"pausado": True, "mensagem": "Sincronização com Google Agenda pausada pelo plano da clínica."}

    from apps.integracoes.google_calendar import reconciliar_google as _reconciliar

    with schema_context(schema_name):
        return _reconciliar()


@shared_task
def reconciliar_google_todos_tenants():
    """Beat: reconcilia cada clínica cujo intervalo configurado já venceu.

    A tarefa roda com frequência alta (Beat), mas só reconcilia a clínica quando
    (agora - última sync) >= intervalo_minutos e há alguma credencial ativa.
    """
    import logging
    from django.db import close_old_connections
    from django.utils import timezone

    from apps.integracoes.google_calendar import reconciliar_google as _reconciliar
    from apps.integracoes.models import ConfiguracaoSincronizacao, CredencialGoogleCalendar
    from apps.tenants.models import Clinica

    logger = logging.getLogger(__name__)
    reconciliadas = 0
    for clinica in Clinica.objects.exclude(schema_name="public"):
        try:
            # O gate de módulo fica DENTRO do try: uma falha ao resolvê-lo (ex.: query
            # do plano/override) não pode abortar o loop e travar as demais clínicas.
            if hasattr(clinica, "recurso_habilitado") and not clinica.recurso_habilitado("google_calendar"):
                continue
            with schema_context(clinica.schema_name):
                if not CredencialGoogleCalendar.objects.filter(ativo=True).exists():
                    continue
                config = ConfiguracaoSincronizacao.objects.first()
                if config is None:
                    config = ConfiguracaoSincronizacao.objects.create()
                ultima = config.ultima_sincronizacao
                if ultima is not None:
                    decorrido = (timezone.now() - ultima).total_seconds()
                    if decorrido < config.intervalo_minutos * 60:
                        continue  # ainda não venceu o intervalo desta clínica
                _reconciliar()
                reconciliadas += 1
        except Exception as exc:
            logger.warning(
                "Falha ao reconciliar Google Calendar para o tenant '%s': %s",
                clinica.schema_name,
                exc,
            )
        finally:
            close_old_connections()
    return reconciliadas


@shared_task
def sincronizar_incremental_todos_tenants():
    """
    Beat: para cada clínica, puxa as mudanças do Google (events.list + syncToken).
    Roda no schema de cada tenant.
    """
    import logging
    from django.db import close_old_connections
    from apps.integracoes.google_calendar import sincronizar_incremental
    from apps.integracoes.models import CredencialGoogleCalendar
    from apps.tenants.models import Clinica

    logger = logging.getLogger(__name__)
    total = 0
    for clinica in Clinica.objects.exclude(schema_name="public"):
        try:
            if hasattr(clinica, "recurso_habilitado") and not clinica.recurso_habilitado("google_calendar"):
                continue
            with schema_context(clinica.schema_name):
                for credencial in CredencialGoogleCalendar.objects.filter(ativo=True):
                    try:
                        total += sincronizar_incremental(credencial)
                    except Exception as cred_exc:
                        logger.warning(
                            "Falha na sincronização incremental da credencial %s no tenant '%s': %s",
                            credencial.id,
                            clinica.schema_name,
                            cred_exc,
                        )
        except Exception as exc:
            logger.warning(
                "Falha ao processar sincronização incremental para o tenant '%s': %s",
                clinica.schema_name,
                exc,
            )
        finally:
            close_old_connections()
    return total


@shared_task
def renovar_watch_channels():
    """
    Beat: re-registra os canais de push (watch) que estão sem expiração ou
    perto de expirar. Usa o domínio primário de cada clínica como endpoint.
    """
    import logging
    from datetime import timedelta
    from django.db import close_old_connections
    from django.db.models import Q
    from django.utils import timezone

    from apps.integracoes.google_calendar import registrar_watch
    from apps.integracoes.models import CredencialGoogleCalendar
    from apps.tenants.models import Clinica

    logger = logging.getLogger(__name__)
    limite = timezone.now() + timedelta(days=1)
    total = 0
    for clinica in Clinica.objects.exclude(schema_name="public"):
        try:
            if hasattr(clinica, "recurso_habilitado") and not clinica.recurso_habilitado("google_calendar"):
                continue
            # A resolução do domínio também fica dentro do try (era um ponto de abort
            # fora da proteção, além de o `continue` pular o finally/close_old_connections).
            dominio = clinica.domains.filter(is_primary=True).first()
            if dominio is None:
                continue
            webhook_url = f"https://{dominio.domain}/integracoes/google/webhook"
            with schema_context(clinica.schema_name):
                expirando = CredencialGoogleCalendar.objects.filter(ativo=True).filter(
                    Q(watch_expiration__isnull=True) | Q(watch_expiration__lte=limite)
                )
                for credencial in expirando:
                    try:
                        registrar_watch(credencial, webhook_url)
                        total += 1
                    except Exception as watch_exc:
                        logger.warning(
                            "Falha ao renovar watch channel para credencial %s no tenant '%s': %s",
                            credencial.id,
                            clinica.schema_name,
                            watch_exc,
                        )
        except Exception as exc:
            logger.warning(
                "Falha ao processar renovação de watch channels para o tenant '%s': %s",
                clinica.schema_name,
                exc,
            )
        finally:
            close_old_connections()
    return total

