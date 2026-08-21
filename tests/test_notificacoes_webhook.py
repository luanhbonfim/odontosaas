"""Testes do webhook de recebimento do WAHA + parser da resposta.

Só confirma a consulta a resposta que cita (replyTo) a mensagem de confirmação
que enviamos — casada pelo `provider_message_id` do log ENVIADA.
"""

import json
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import connection
from django.test import Client, override_settings
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.notificacoes.inbound import interpretar_resposta
from apps.notificacoes.models import ConfiguracaoNotificacao, LogNotificacao
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio

MSG_ID = "WAHA-MSG-WEBHOOK-1"


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _preparar(session="clinica-x", telefone="5511999998888"):
    """Cria a config, a consulta PENDENTE e o log ENVIADA (com provider_message_id)."""
    ConfiguracaoNotificacao.objects.create(waha_session=session, ativo=True)
    paciente = Paciente.objects.create(
        nome_completo="Ana", cpf="55511122233", telefone_whatsapp=telefone
    )
    dentista = Dentista.objects.create(nome_completo="Dr. X", cro="CRO-1")
    inicio = timezone.now() + timedelta(days=1)
    consulta = Consulta.objects.create(
        paciente=paciente, dentista=dentista, inicio=inicio, fim=inicio + timedelta(minutes=30)
    )
    LogNotificacao.objects.create(
        consulta=consulta,
        direcao=LogNotificacao.Direcao.ENVIADA,
        status=LogNotificacao.Status.ENVIADA,
        provider_message_id=MSG_ID,
    )
    return consulta


# --- Parser (sem banco) ---
@pytest.mark.parametrize(
    ("texto", "esperado"),
    [
        ("Sim", "CONFIRMA"),
        ("1", "CONFIRMA"),
        ("confirmo", "CONFIRMA"),
        ("Não", "RECUSA"),
        ("2", "RECUSA"),
        ("cancelar", "RECUSA"),
        ("talvez", None),
    ],
)
def test_interpretar_resposta(texto, esperado):
    assert interpretar_resposta(texto) == esperado


def _post_webhook(
    client,
    host,
    session,
    body,
    reply_to=MSG_ID,
    numero="5511999998888",
    event="message",
    from_me=False,
):
    payload = {
        "event": event,
        "session": session,
        "payload": {"from": f"{numero}@c.us", "body": body, "fromMe": from_me, "replyTo": reply_to},
    }
    # O host só precisa resolver para um tenant (o middleware); o schema real
    # do processamento vem da `session` do payload.
    return client.post(
        "/notificacoes/whatsapp/webhook",
        data=json.dumps(payload),
        content_type="application/json",
        HTTP_HOST=host,
    )


@pytest.mark.django_db(transaction=True)
def test_webhook_registra_resposta():
    clinica = _criar_clinica("wahain_tenant", "wahain.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _preparar(session="clinica-wahain")
            cid = consulta.id

        client = Client()
        with (
            patch("apps.notificacoes.inbound.sincronizar_evento_google"),
            patch("apps.notificacoes.inbound.enviar_texto"),
        ):
            resp = _post_webhook(client, "wahain.localhost", "clinica-wahain", "Sim")
        assert resp.status_code == 200

        with schema_context(clinica.schema_name):
            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            log = LogNotificacao.objects.get(consulta_id=cid, direcao="RECEBIDA")
            assert log.resposta_paciente == "Sim"
            assert log.status == "RESPONDIDA"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_webhook_ignora_eventos_e_respostas_avulsas():
    clinica = _criar_clinica("wahain2_tenant", "wahain2.localhost")
    try:
        with schema_context(clinica.schema_name):
            _preparar(session="clinica-wahain2")

        client = Client()
        host = "wahain2.localhost"
        with (
            patch("apps.notificacoes.inbound.sincronizar_evento_google"),
            patch("apps.notificacoes.inbound.enviar_texto"),
        ):
            # evento diferente de message
            assert (
                _post_webhook(client, host, "clinica-wahain2", "sim", event="state").status_code
                == 200
            )
            # mensagem enviada por nós
            assert (
                _post_webhook(client, host, "clinica-wahain2", "sim", from_me=True).status_code
                == 200
            )
            # session desconhecida -> nada registrado
            assert _post_webhook(client, host, "sessao-inexistente", "sim").status_code == 200
            # "sim" digitado direto de um número SEM confirmação pendente -> ignorado
            assert (
                _post_webhook(
                    client, host, "clinica-wahain2", "sim", reply_to="", numero="5511900000000"
                ).status_code
                == 200
            )
        # corpo JSON inválido -> 400
        resp = client.post(
            "/notificacoes/whatsapp/webhook",
            data="isso-nao-e-json",
            content_type="application/json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400

        with schema_context(clinica.schema_name):
            assert LogNotificacao.objects.filter(direcao="RECEBIDA").count() == 0
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
@override_settings(WAHA_WEBHOOK_TOKEN="segredo-teste")
def test_webhook_exige_token_quando_configurado():
    """Com WAHA_WEBHOOK_TOKEN definido, o webhook rejeita (401) sem o token correto
    e processa (200) com o token — fecha o vetor de forja de respostas cross-tenant."""
    clinica = _criar_clinica("wahain4_tenant", "wahain4.localhost")
    try:
        with schema_context(clinica.schema_name):
            _preparar(session="clinica-wahain4")

        client = Client()
        host = "wahain4.localhost"
        corpo = json.dumps(
            {
                "event": "message",
                "session": "clinica-wahain4",
                "payload": {
                    "from": "5511999998888@c.us",
                    "body": "sim",
                    "fromMe": False,
                    "replyTo": MSG_ID,
                },
            }
        )
        with (
            patch("apps.notificacoes.inbound.sincronizar_evento_google"),
            patch("apps.notificacoes.inbound.enviar_texto"),
        ):
            # Sem token -> 401 (não processa)
            assert _post_webhook(client, host, "clinica-wahain4", "sim").status_code == 401
            # Token errado -> 401
            assert client.post(
                "/notificacoes/whatsapp/webhook?token=errado",
                data=corpo,
                content_type="application/json",
                HTTP_HOST=host,
            ).status_code == 401
            # Token correto (query string) -> 200 e processa
            assert client.post(
                "/notificacoes/whatsapp/webhook?token=segredo-teste",
                data=corpo,
                content_type="application/json",
                HTTP_HOST=host,
            ).status_code == 200

        # Só a chamada autenticada registrou a resposta.
        with schema_context(clinica.schema_name):
            assert LogNotificacao.objects.filter(direcao="RECEBIDA").count() == 1
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_webhook_confirma_sim_digitado_direto():
    """Idoso digita só 'SIM' (sem citar) -> confirma casando pelo telefone."""
    clinica = _criar_clinica("wahain3_tenant", "wahain3.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _preparar(session="clinica-wahain3")
            cid = consulta.id

        client = Client()
        with (
            patch("apps.notificacoes.inbound.sincronizar_evento_google"),
            patch("apps.notificacoes.inbound.enviar_texto"),
        ):
            resp = _post_webhook(client, "wahain3.localhost", "clinica-wahain3", "sim", reply_to="")
        assert resp.status_code == 200

        with schema_context(clinica.schema_name):
            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            assert LogNotificacao.objects.filter(consulta_id=cid, direcao="RECEBIDA").exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
