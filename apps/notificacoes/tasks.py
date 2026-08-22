"""Tasks Celery de notificações WhatsApp (WAHA)."""

from datetime import timedelta

from celery import shared_task
from django.utils import timezone
from django_tenants.utils import schema_context
from requests import RequestException

from apps.agenda.models import Consulta
from apps.notificacoes.defaults import CORPO_PADRAO_CANCELAMENTO
from apps.notificacoes.models import (
    ConfiguracaoNotificacao,
    LogNotificacao,
    TemplateMensagem,
)
from apps.notificacoes.waha import (
    enviar_digitando,
    enviar_texto,
    garantir_sessao,
    id_da_mensagem,
    numero_valido,
)


def _enviar(config, numero, texto):
    """Envia texto humanizando com 'digitando…' conforme a preferência da clínica.

    Se `config.simular_digitacao` e `config.segundos_digitacao > 0`, mostra o presence
    de digitação por esse tempo antes de enviar (best-effort). Referencia os nomes de
    módulo `enviar_digitando`/`enviar_texto` para permanecer mockável nos testes.
    """
    if getattr(config, "simular_digitacao", False) and getattr(config, "segundos_digitacao", 0):
        enviar_digitando(config.waha_session, numero, segundos=config.segundos_digitacao)
    return enviar_texto(config.waha_session, numero, texto)


def _renderizar(corpo, consulta, link=""):
    """Substitui as variáveis do template pelos dados da consulta (+ {{link}}).

    A data/hora é convertida para o fuso local (TIME_ZONE) — `consulta.inicio`
    é armazenada em UTC; sem localizar, a mensagem mostraria a hora em UTC.
    """
    inicio = timezone.localtime(consulta.inicio)
    return (
        corpo.replace("{{paciente}}", consulta.paciente.nome_completo)
        .replace("{{data}}", inicio.strftime("%d/%m/%Y"))
        .replace("{{hora}}", inicio.strftime("%H:%M"))
        .replace("{{dentista}}", consulta.dentista.nome_completo)
        .replace("{{link}}", link)
    )


def _base_do_tenant():
    from django.db import connection

    tenant = getattr(connection, "tenant", None)
    try:
        dominio = tenant.get_primary_domain() if tenant else None
    except Exception:  # noqa: BLE001 — sem domínio primário -> link relativo
        dominio = None
    return f"https://{dominio.domain}" if dominio else ""


def link_confirmacao(consulta):
    """Link público (absoluto) de confirmação da consulta; gera o token se faltar."""
    import uuid

    from django.conf import settings

    if not consulta.confirmacao_token:
        consulta.confirmacao_token = uuid.uuid4()
        consulta.save(update_fields=["confirmacao_token", "atualizado_em"])
    base = (getattr(settings, "APP_BASE_URL", "") or _base_do_tenant()).rstrip("/")
    return f"{base}/c/{consulta.confirmacao_token}"


def _mensagem_confirmacao(template, consulta):
    """Renderiza o corpo da confirmação e garante o link (auto-anexa se faltar)."""
    link = link_confirmacao(consulta)
    mensagem = _renderizar(template.corpo, consulta, link=link)
    if link and link not in mensagem:
        mensagem = f"{mensagem}\n\n✅ Confirmar / ❌ Cancelar: {link}"
    return mensagem


def enviar_confirmacao_manual(consulta):
    """Envia (ou reenvia) o pedido de confirmação de UMA consulta, sob demanda.

    Retorna o `LogNotificacao` criado. Levanta `ValueError` se faltar a
    configuração ou um template de Confirmação ativo.
    """
    config = ConfiguracaoNotificacao.objects.filter(ativo=True).first()
    template = TemplateMensagem.objects.filter(
        tipo=TemplateMensagem.Tipo.CONFIRMACAO, ativo=True
    ).first()
    if config is None or template is None:
        raise ValueError(
            "Configure a notificação e um template de Confirmação ativo antes de enviar."
        )
    if not numero_valido(consulta.paciente.telefone_whatsapp):
        raise ValueError(
            "O paciente não tem um número de WhatsApp válido. Cadastre com DDD "
            "(ex.: (18) 99690-2466) — o código do país (55) é adicionado automaticamente."
        )

    garantir_sessao(config.waha_session)
    mensagem = _mensagem_confirmacao(template, consulta)
    try:
        payload = _enviar(config, consulta.paciente.telefone_whatsapp, mensagem)
        status = LogNotificacao.Status.ENVIADA
    except RequestException as exc:
        payload = {"erro": str(exc)}
        status = LogNotificacao.Status.ERRO

    return LogNotificacao.objects.create(
        consulta=consulta,
        template=template,
        direcao=LogNotificacao.Direcao.ENVIADA,
        mensagem=mensagem,
        status=status,
        enviado_em=timezone.now(),
        provider_message_id=id_da_mensagem(payload),
        payload_provedor=payload if isinstance(payload, dict) else {},
    )


def enviar_cancelamento(consulta):
    """Avisa o paciente que a consulta foi cancelada (recusa ou cancelamento manual).

    Usa o template CANCELAMENTO (ativo), se houver; senão, um texto padrão.
    Silencioso: sem config/número válido, não faz nada. Retorna o log ou None.
    """
    config = ConfiguracaoNotificacao.objects.filter(ativo=True).first()
    if config is None or not config.waha_session:
        return None
    if not config.enviar_cancelamento:  # permissão desligada -> não avisa
        return None
    if not numero_valido(consulta.paciente.telefone_whatsapp):
        return None

    template = TemplateMensagem.objects.filter(
        tipo=TemplateMensagem.Tipo.CANCELAMENTO, ativo=True
    ).first()
    corpo = template.corpo if template else CORPO_PADRAO_CANCELAMENTO
    mensagem = _renderizar(corpo, consulta)

    garantir_sessao(config.waha_session)
    try:
        payload = _enviar(config, consulta.paciente.telefone_whatsapp, mensagem)
        status = LogNotificacao.Status.ENVIADA
    except RequestException as exc:
        payload = {"erro": str(exc)}
        status = LogNotificacao.Status.ERRO

    return LogNotificacao.objects.create(
        consulta=consulta,
        template=template,
        direcao=LogNotificacao.Direcao.ENVIADA,
        mensagem=mensagem,
        status=status,
        enviado_em=timezone.now(),
        provider_message_id=id_da_mensagem(payload),
        payload_provedor=payload if isinstance(payload, dict) else {},
    )


@shared_task(autoretry_for=(Exception,), max_retries=3, default_retry_delay=60, retry_backoff=True)
def enviar_cancelamento_task(schema_name, consulta_id):
    """Envia a mensagem de cancelamento no schema do tenant (disparado por signal)."""
    # Respeita o módulo de WhatsApp do plano/override (EXTRA-V7.25): clínica com o
    # módulo desligado não dispara mensagens, sem apagar as configurações salvas.
    from apps.tenants.models import Clinica

    clinica = Clinica.objects.filter(schema_name=schema_name).first()
    if clinica and hasattr(clinica, "recurso_habilitado") and not clinica.recurso_habilitado("whatsapp"):
        return
    with schema_context(schema_name):
        consulta = (
            Consulta.objects.select_related("paciente", "dentista")
            .filter(pk=consulta_id)
            .first()
        )
        if consulta is not None:
            enviar_cancelamento(consulta)


def _disparar_lembretes_do_tenant():
    """Dispara os pedidos de confirmação do tenant atual. Retorna nº de enviados."""
    config = ConfiguracaoNotificacao.objects.filter(ativo=True).first()
    template = TemplateMensagem.objects.filter(
        tipo=TemplateMensagem.Tipo.CONFIRMACAO, ativo=True
    ).first()
    if config is None or template is None:
        return 0

    # Respeita o horário de envio configurado: antes dele, ainda não dispara
    # (o Beat roda de hora em hora; a partir do horário, sai no próximo tique).
    if timezone.localtime().time() < config.horario_envio:
        return 0

    # Janela de antecedência: pega TODAS as consultas futuras até `alvo` — não só
    # as da data exata. Assim um agendamento de última hora (dentro da janela, ex.:
    # marcado hoje para amanhã, ou para hoje) também recebe a confirmação, saindo
    # no próximo disparo (catch-up) em vez de ser pulado.
    alvo = timezone.localdate() + timedelta(days=config.dias_antecedencia)
    consultas = list(
        Consulta.objects.filter(
            inicio__date__lte=alvo,
            inicio__gte=timezone.now(),
            status=Consulta.Status.AGENDADA,
            status_confirmacao=Consulta.StatusConfirmacao.PENDENTE,
            paciente__ativo=True,  # N12: não lembra paciente inativo
        )
        # N9: só suprime quem já recebeu com SUCESSO (envio com ERRO é reenviado).
        .exclude(
            notificacoes__direcao=LogNotificacao.Direcao.ENVIADA,
            notificacoes__status=LogNotificacao.Status.ENVIADA,
        )
    )

    if consultas:
        garantir_sessao(config.waha_session)

    enviados = 0
    for consulta in consultas:
        mensagem = _mensagem_confirmacao(template, consulta)
        try:
            payload = _enviar(config, consulta.paciente.telefone_whatsapp, mensagem)
            status = LogNotificacao.Status.ENVIADA
        except RequestException as exc:
            payload = {"erro": str(exc)}
            status = LogNotificacao.Status.ERRO

        LogNotificacao.objects.create(
            consulta=consulta,
            template=template,
            direcao=LogNotificacao.Direcao.ENVIADA,
            mensagem=mensagem,
            status=status,
            enviado_em=timezone.now(),
            provider_message_id=id_da_mensagem(payload),
            payload_provedor=payload if isinstance(payload, dict) else {},
        )
        if status == LogNotificacao.Status.ENVIADA:
            enviados += 1
    return enviados


@shared_task
def disparar_lembretes_todos_tenants():
    """Beat: varre as clínicas e dispara os pedidos de confirmação pendentes."""
    return _para_cada_tenant(_disparar_lembretes_do_tenant)


# --- Lembretes/Recall (templates LEMBRETE) -----------------------------------


def _enviar_lembrete(config, template, consulta):
    """Envia um lembrete (recall/aviso) e registra o log. Retorna 1 se enviado."""
    if not numero_valido(consulta.paciente.telefone_whatsapp):
        return 0
    garantir_sessao(config.waha_session)
    mensagem = _renderizar(template.corpo, consulta)
    try:
        payload = _enviar(config, consulta.paciente.telefone_whatsapp, mensagem)
        status = LogNotificacao.Status.ENVIADA
    except RequestException as exc:
        payload = {"erro": str(exc)}
        status = LogNotificacao.Status.ERRO

    LogNotificacao.objects.create(
        consulta=consulta,
        template=template,
        direcao=LogNotificacao.Direcao.ENVIADA,
        mensagem=mensagem,
        status=status,
        enviado_em=timezone.now(),
        provider_message_id=id_da_mensagem(payload),
        payload_provedor=payload if isinstance(payload, dict) else {},
    )
    return 1 if status == LogNotificacao.Status.ENVIADA else 0


def _ja_enviou(template, consulta):
    """Já mandamos este lembrete para esta consulta? (dedup)."""
    return LogNotificacao.objects.filter(
        template=template,
        consulta=consulta,
        direcao=LogNotificacao.Direcao.ENVIADA,
    ).exists()


def _ja_enviou_lembrete(template, consulta):
    """Como `_ja_enviou`, mas um REAGENDAMENTO rearma o lembrete: só conta envios
    feitos DEPOIS do último reagendamento (para reenviar no novo horário — um
    lembrete por 'versão' da consulta)."""
    envios = LogNotificacao.objects.filter(
        template=template,
        consulta=consulta,
        direcao=LogNotificacao.Direcao.ENVIADA,
    )
    if consulta.reagendada_em:
        envios = envios.filter(criado_em__gte=consulta.reagendada_em)
    return envios.exists()


def _ja_avisou_reagendamento(template, consulta):
    """Já avisamos o reagendamento atual? (dedup por 'versão' — reagendada_em)."""
    return LogNotificacao.objects.filter(
        template=template,
        consulta=consulta,
        direcao=LogNotificacao.Direcao.ENVIADA,
        criado_em__gte=consulta.reagendada_em,
    ).exists()


def _reagendamento(config, template):
    """Avisa pacientes CONFIRMADOS cujas consultas foram REAGENDADAS (uma vez por
    reagendamento), respeitando o atraso configurado (`reagendamento_minutos`)."""
    agora = timezone.now()
    consultas = Consulta.objects.filter(
        status=Consulta.Status.AGENDADA,
        status_confirmacao=Consulta.StatusConfirmacao.CONFIRMADA,
        reagendada_em__isnull=False,
        inicio__gte=agora,
        paciente__ativo=True,
    ).select_related("paciente", "dentista")
    atraso = timedelta(minutes=config.reagendamento_minutos)
    enviados = 0
    for consulta in consultas:
        if agora < consulta.reagendada_em + atraso:
            continue  # ainda dentro do atraso configurado
        if _ja_avisou_reagendamento(template, consulta):
            continue
        enviados += _enviar_lembrete(config, template, consulta)
    return enviados


def _recall(config, template):
    """Recall: chama de volta quem fez o procedimento há mais que o intervalo e
    não tem retorno marcado. Envia UMA vez por 'última consulta' (até voltar)."""
    limite = timezone.now() - timedelta(days=30 * template.intervalo_meses)
    pac_ids = (
        Consulta.objects.filter(
            procedimento_catalogo=template.procedimento_id,
            status=Consulta.Status.REALIZADA,
        )
        .values_list("paciente_id", flat=True)
        .distinct()
    )
    enviados = 0
    for paciente_id in pac_ids:
        ultima = (
            Consulta.objects.filter(
                paciente_id=paciente_id,
                procedimento_catalogo=template.procedimento_id,
                status=Consulta.Status.REALIZADA,
            )
            .select_related("paciente", "dentista")
            .order_by("-inicio")
            .first()
        )
        if ultima is None or ultima.inicio > limite:
            continue  # ainda dentro do intervalo
        if not ultima.paciente.ativo:
            continue
        # Já tem retorno futuro (do procedimento) marcado? -> vai voltar, não chama.
        tem_retorno = (
            Consulta.objects.filter(
                paciente_id=paciente_id,
                procedimento_catalogo=template.procedimento_id,
                inicio__gte=timezone.now(),
            )
            .exclude(status=Consulta.Status.CANCELADA)
            .exists()
        )
        if tem_retorno or _ja_enviou(template, ultima):
            continue
        enviados += _enviar_lembrete(config, template, ultima)
    return enviados


def _aviso_pre_consulta(config, template):
    """Aviso: avisa pacientes CONFIRMADOS que faltam X horas para a consulta."""
    fim = timezone.now() + timedelta(hours=template.horas_antes)
    consultas = Consulta.objects.filter(
        status=Consulta.Status.AGENDADA,
        status_confirmacao=Consulta.StatusConfirmacao.CONFIRMADA,
        inicio__gte=timezone.now(),
        inicio__lte=fim,
        paciente__ativo=True,
    ).select_related("paciente", "dentista")
    enviados = 0
    for consulta in consultas:
        if _ja_enviou_lembrete(template, consulta):
            continue
        enviados += _enviar_lembrete(config, template, consulta)
    return enviados


def _config_lembretes():
    """Config ativa com sessão do WhatsApp (ou None se não dá para enviar)."""
    config = ConfiguracaoNotificacao.objects.filter(ativo=True).first()
    if config is None or not config.waha_session:
        return None
    return config


def _processar_avisos_do_tenant():
    """Só os avisos antes da consulta (PRE_CONSULTA) — precisam ser pontuais."""
    config = _config_lembretes()
    if config is None:
        return 0
    enviados = 0
    for template in TemplateMensagem.objects.filter(
        tipo=TemplateMensagem.Tipo.LEMBRETE,
        lembrete_tipo=TemplateMensagem.LembreteTipo.PRE_CONSULTA,
        ativo=True,
    ):
        if template.horas_antes:
            enviados += _aviso_pre_consulta(config, template)
    return enviados


def _processar_recall_do_tenant():
    """Só o recall por procedimento (RECALL) — não precisa de horário exato."""
    config = _config_lembretes()
    if config is None:
        return 0
    enviados = 0
    for template in TemplateMensagem.objects.filter(
        tipo=TemplateMensagem.Tipo.LEMBRETE,
        lembrete_tipo=TemplateMensagem.LembreteTipo.RECALL,
        ativo=True,
    ):
        if template.procedimento_id and template.intervalo_meses:
            enviados += _recall(config, template)
    return enviados


def _processar_reagendamentos_do_tenant():
    """Avisa reagendamentos pendentes do tenant (respeita a permissão + template)."""
    config = _config_lembretes()
    if config is None or not config.enviar_reagendamento:
        return 0
    template = TemplateMensagem.objects.filter(
        tipo=TemplateMensagem.Tipo.REAGENDAMENTO, ativo=True
    ).first()
    if template is None:
        return 0
    return _reagendamento(config, template)


def _processar_pontuais_do_tenant():
    """Envios pontuais (Beat de 1 min): avisos pré-consulta + reagendamentos."""
    return _processar_avisos_do_tenant() + _processar_reagendamentos_do_tenant()


def _processar_lembretes_do_tenant():
    """Processa TODOS os lembretes do tenant (avisos + recall). Usado nos testes."""
    return _processar_avisos_do_tenant() + _processar_recall_do_tenant()


def _para_cada_tenant(funcao):
    import logging
    from django.db import close_old_connections
    from apps.tenants.models import Clinica

    logger = logging.getLogger(__name__)
    total = 0
    for clinica in Clinica.objects.exclude(schema_name="public"):
        try:
            # Gate de módulo dentro do try: erro ao resolvê-lo não pode abortar o loop
            # inteiro (isolamento por tenant — VULN-06).
            if hasattr(clinica, "recurso_habilitado") and not clinica.recurso_habilitado("whatsapp"):
                continue
            with schema_context(clinica.schema_name):
                total += funcao()
        except Exception as exc:
            logger.warning(
                "Falha ao executar rotina de notificações para o tenant '%s': %s",
                clinica.schema_name,
                exc,
            )
        finally:
            close_old_connections()
    return total


@shared_task
def processar_avisos_todos_tenants():
    """Beat (frequente): dispara os avisos antes da consulta de cada clínica.

    Roda a cada 1 min para o aviso sair na hora certa (ex.: 1h antes = às 20h para
    uma consulta das 21h), sem a folga de rodadas espaçadas. Inclui também os
    avisos de reagendamento (saem no próximo minuto após a consulta ser remarcada)."""
    return _para_cada_tenant(_processar_pontuais_do_tenant)


@shared_task
def processar_recall_todos_tenants():
    """Beat (esparso): dispara o recall por procedimento de cada clínica."""
    return _para_cada_tenant(_processar_recall_do_tenant)


# --- Fila (projeção do que ainda vai sair, sem enviar) ------------------------


def fila_pendente():
    """Projeta as mensagens automáticas que ainda vão ser enviadas (não envia).

    Reusa a mesma elegibilidade das tasks:
    - CONFIRMACAO: consultas futuras AGENDADA/PENDENTE, paciente ativo, que ainda
      não receberam confirmação com sucesso. `previsto_para` = (data da consulta −
      dias de antecedência) no horário de envio (ou "próximo disparo" se atrasado).
    - PRE_CONSULTA: consultas CONFIRMADAS futuras (por template de aviso ativo)
      ainda não avisadas. `previsto_para` = início − horas antes.

    Retorna lista de dicts ordenada por `previsto_para`.
    """
    from datetime import datetime

    config = ConfiguracaoNotificacao.objects.filter(ativo=True).first()
    if config is None:
        return []

    agora = timezone.now()
    tz = timezone.get_current_timezone()
    itens = []

    # 1) Pedidos de confirmação pendentes.
    if TemplateMensagem.objects.filter(
        tipo=TemplateMensagem.Tipo.CONFIRMACAO, ativo=True
    ).exists():
        pendentes = (
            Consulta.objects.filter(
                status=Consulta.Status.AGENDADA,
                status_confirmacao=Consulta.StatusConfirmacao.PENDENTE,
                inicio__gte=agora,
                paciente__ativo=True,
            )
            .exclude(
                notificacoes__direcao=LogNotificacao.Direcao.ENVIADA,
                notificacoes__status=LogNotificacao.Status.ENVIADA,
            )
            .select_related("paciente", "dentista")
        )
        for consulta in pendentes:
            data_envio = timezone.localtime(consulta.inicio).date() - timedelta(
                days=config.dias_antecedencia
            )
            previsto = timezone.make_aware(
                datetime.combine(data_envio, config.horario_envio), tz
            )
            itens.append(
                {
                    "tipo": TemplateMensagem.Tipo.CONFIRMACAO,
                    "consulta": consulta.id,
                    "paciente_nome": consulta.paciente.nome_completo,
                    "consulta_inicio": consulta.inicio,
                    "previsto_para": previsto,
                    "atrasado": previsto < agora,
                    "telefone_ok": numero_valido(consulta.paciente.telefone_whatsapp),
                }
            )

    # 2) Avisos antes da consulta (pacientes confirmados).
    for template in TemplateMensagem.objects.filter(
        tipo=TemplateMensagem.Tipo.LEMBRETE,
        lembrete_tipo=TemplateMensagem.LembreteTipo.PRE_CONSULTA,
        ativo=True,
    ):
        if not template.horas_antes:
            continue
        confirmadas = Consulta.objects.filter(
            status=Consulta.Status.AGENDADA,
            status_confirmacao=Consulta.StatusConfirmacao.CONFIRMADA,
            inicio__gte=agora,
            paciente__ativo=True,
        ).select_related("paciente", "dentista")
        for consulta in confirmadas:
            if _ja_enviou_lembrete(template, consulta):
                continue
            previsto = consulta.inicio - timedelta(hours=template.horas_antes)
            itens.append(
                {
                    "tipo": TemplateMensagem.Tipo.LEMBRETE,
                    "lembrete_tipo": TemplateMensagem.LembreteTipo.PRE_CONSULTA,
                    "consulta": consulta.id,
                    "paciente_nome": consulta.paciente.nome_completo,
                    "consulta_inicio": consulta.inicio,
                    "previsto_para": previsto,
                    "atrasado": previsto < agora,
                    "telefone_ok": numero_valido(consulta.paciente.telefone_whatsapp),
                }
            )

    # 3) Avisos de reagendamento (consultas remarcadas ainda não avisadas) — saem
    # no próximo minuto (Beat de 1 min).
    if config.enviar_reagendamento:
        template = TemplateMensagem.objects.filter(
            tipo=TemplateMensagem.Tipo.REAGENDAMENTO, ativo=True
        ).first()
        if template:
            remarcadas = Consulta.objects.filter(
                status=Consulta.Status.AGENDADA,
                status_confirmacao=Consulta.StatusConfirmacao.CONFIRMADA,
                reagendada_em__isnull=False,
                inicio__gte=agora,
                paciente__ativo=True,
            ).select_related("paciente", "dentista")
            atraso = timedelta(minutes=config.reagendamento_minutos)
            for consulta in remarcadas:
                if _ja_avisou_reagendamento(template, consulta):
                    continue
                previsto = consulta.reagendada_em + atraso
                itens.append(
                    {
                        "tipo": TemplateMensagem.Tipo.REAGENDAMENTO,
                        "consulta": consulta.id,
                        "paciente_nome": consulta.paciente.nome_completo,
                        "consulta_inicio": consulta.inicio,
                        "previsto_para": previsto,
                        "atrasado": previsto < agora,
                        "telefone_ok": numero_valido(consulta.paciente.telefone_whatsapp),
                    }
                )

    itens.sort(key=lambda item: item["previsto_para"])
    return itens
