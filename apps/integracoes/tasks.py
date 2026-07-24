"""Tasks Celery do app integracoes (sincronização com o Google Calendar)."""

from celery import shared_task
from django_tenants.utils import schema_context


@shared_task
def sincronizar_evento_google(schema_name, consulta_id):
    """Sincroniza a consulta com o Google Calendar dentro do schema do tenant."""
    from apps.agenda.models import Consulta
    from apps.integracoes.google_calendar import sincronizar_consulta

    with schema_context(schema_name):
        consulta = Consulta.objects.get(pk=consulta_id)
        evento = sincronizar_consulta(consulta)
        return evento.google_event_id


@shared_task
def sincronizar_incremental_todos_tenants():
    """
    Beat: para cada clínica, puxa as mudanças do Google (events.list + syncToken).
    Roda no schema de cada tenant.
    """
    from apps.integracoes.google_calendar import sincronizar_incremental
    from apps.integracoes.models import CredencialGoogleCalendar
    from apps.tenants.models import Clinica

    total = 0
    for clinica in Clinica.objects.exclude(schema_name="public"):
        with schema_context(clinica.schema_name):
            for credencial in CredencialGoogleCalendar.objects.filter(ativo=True):
                total += sincronizar_incremental(credencial)
    return total


@shared_task
def renovar_watch_channels():
    """
    Beat: re-registra os canais de push (watch) que estão sem expiração ou
    perto de expirar. Usa o domínio primário de cada clínica como endpoint.
    """
    from datetime import timedelta

    from django.db.models import Q
    from django.utils import timezone

    from apps.integracoes.google_calendar import registrar_watch
    from apps.integracoes.models import CredencialGoogleCalendar
    from apps.tenants.models import Clinica

    limite = timezone.now() + timedelta(days=1)
    total = 0
    for clinica in Clinica.objects.exclude(schema_name="public"):
        dominio = clinica.domains.filter(is_primary=True).first()
        if dominio is None:
            continue
        webhook_url = f"https://{dominio.domain}/integracoes/google/webhook"
        with schema_context(clinica.schema_name):
            expirando = CredencialGoogleCalendar.objects.filter(ativo=True).filter(
                Q(watch_expiration__isnull=True) | Q(watch_expiration__lte=limite)
            )
            for credencial in expirando:
                registrar_watch(credencial, webhook_url)
                total += 1
    return total
