"""Tasks Celery de notificações WhatsApp (WAHA)."""

from datetime import timedelta

from celery import shared_task
from django.utils import timezone
from django_tenants.utils import schema_context
from requests import RequestException

from apps.agenda.models import Consulta
from apps.notificacoes.models import (
    ConfiguracaoNotificacao,
    LogNotificacao,
    TemplateMensagem,
)
from apps.notificacoes.waha import enviar_texto, garantir_sessao, id_da_mensagem


def _renderizar(corpo, consulta):
    """Substitui as variáveis do template pelos dados da consulta."""
    return (
        corpo.replace("{{paciente}}", consulta.paciente.nome_completo)
        .replace("{{data}}", consulta.inicio.strftime("%d/%m/%Y"))
        .replace("{{hora}}", consulta.inicio.strftime("%H:%M"))
        .replace("{{dentista}}", consulta.dentista.nome_completo)
    )


def _disparar_lembretes_do_tenant():
    """Dispara os pedidos de confirmação do tenant atual. Retorna nº de enviados."""
    config = ConfiguracaoNotificacao.objects.filter(ativo=True).first()
    template = TemplateMensagem.objects.filter(
        tipo=TemplateMensagem.Tipo.CONFIRMACAO, ativo=True
    ).first()
    if config is None or template is None:
        return 0

    alvo = timezone.localdate() + timedelta(days=config.dias_antecedencia)
    consultas = list(
        Consulta.objects.filter(
            inicio__date=alvo,
            status=Consulta.Status.AGENDADA,
            status_confirmacao=Consulta.StatusConfirmacao.PENDENTE,
        ).exclude(notificacoes__direcao=LogNotificacao.Direcao.ENVIADA)
    )

    if consultas:
        garantir_sessao(config.waha_session)

    enviados = 0
    for consulta in consultas:
        mensagem = _renderizar(template.corpo, consulta)
        try:
            payload = enviar_texto(
                config.waha_session, consulta.paciente.telefone_whatsapp, mensagem
            )
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
    from apps.tenants.models import Clinica

    total = 0
    for clinica in Clinica.objects.exclude(schema_name="public"):
        with schema_context(clinica.schema_name):
            total += _disparar_lembretes_do_tenant()
    return total
