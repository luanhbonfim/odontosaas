"""Testes do gatilho: resposta do paciente -> status_confirmacao -> sync Google.

Casamento híbrido: (1) resposta citando (replyTo) a confirmação que enviamos, ou
(2) SIM/NÃO digitado direto casado pelo telefone do paciente, desde que haja uma
confirmação nossa pendente para ele.
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context
from requests import RequestException

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.notificacoes.inbound import registrar_resposta
from apps.notificacoes.models import ConfiguracaoNotificacao, LogNotificacao
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio

TELEFONE = "5511999998888"
MSG_ID = "WAHA-MSG-CONFIRMACAO-1"


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _consulta_com_confirmacao_enviada(session="sess-x", com_envio=True):
    """Cria consulta PENDENTE (+ opcionalmente o log ENVIADA da confirmação)."""
    ConfiguracaoNotificacao.objects.create(waha_session=session, ativo=True)
    paciente = Paciente.objects.create(
        nome_completo="Ana", cpf="55511122233", telefone_whatsapp=TELEFONE
    )
    dentista = Dentista.objects.create(nome_completo="Dr. X", cro="CRO-1")
    inicio = timezone.now() + timedelta(days=1)
    consulta = Consulta.objects.create(
        paciente=paciente, dentista=dentista, inicio=inicio, fim=inicio + timedelta(minutes=30)
    )
    if com_envio:
        LogNotificacao.objects.create(
            consulta=consulta,
            direcao=LogNotificacao.Direcao.ENVIADA,
            status=LogNotificacao.Status.ENVIADA,
            provider_message_id=MSG_ID,
        )
    return consulta


def _payload(body, reply_to=MSG_ID):
    return {"from": f"{TELEFONE}@c.us", "body": body, "fromMe": False, "replyTo": reply_to}


@pytest.mark.django_db(transaction=True)
def test_confirma_atualiza_status_e_dispara_sync():
    clinica = _criar_clinica("gatilho_ok_tenant", "gatilhook.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            cid = consulta.id
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google") as mock_task,
                patch("apps.notificacoes.inbound.enviar_texto") as mock_envia,
            ):
                log = registrar_resposta(schema, _payload("Sim"))

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            assert consulta.confirmado_em is not None
            mock_task.delay.assert_called_once_with(schema, cid)
            mock_envia.assert_called_once()  # mensagem de agradecimento enviada
            assert log.direcao == "RECEBIDA"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_recusa_atualiza_status_sem_sync():
    clinica = _criar_clinica("gatilho_rec_tenant", "gatilhorec.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google") as mock_task,
                patch("apps.notificacoes.inbound.enviar_texto") as mock_envia,
            ):
                registrar_resposta(schema, _payload("Não"))

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "RECUSADA"
            mock_task.delay.assert_not_called()
            mock_envia.assert_not_called()  # não agradece em recusa
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_resposta_desconhecida_nao_muda_status():
    clinica = _criar_clinica("gatilho_unk_tenant", "gatilhounk.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google") as mock_task,
                patch("apps.notificacoes.inbound.enviar_texto"),
            ):
                log = registrar_resposta(schema, _payload("talvez amanhã"))

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "PENDENTE"  # inalterado
            mock_task.delay.assert_not_called()
            assert log is not None  # resposta registrada mesmo sem interpretação
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_sim_digitado_direto_casa_pelo_telefone():
    """Idoso: só digita 'SIM' (sem citar). Casa pelo telefone e confirma."""
    clinica = _criar_clinica("gatilho_direto_tenant", "gatilhodireto.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            payload = {"from": f"{TELEFONE}@c.us", "body": "sim", "fromMe": False}
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google") as mock_task,
                patch("apps.notificacoes.inbound.enviar_texto") as mock_envia,
            ):
                log = registrar_resposta(schema, payload)

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            mock_task.delay.assert_called_once()
            mock_envia.assert_called_once()
            assert log.direcao == "RECEBIDA"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_sim_via_lid_casa_por_remote_jid_alt():
    """`from` vem como LID, mas o telefone real está em _data.key.remoteJidAlt."""
    clinica = _criar_clinica("gatilho_lid_tenant", "gatilholid.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            payload = {
                "from": "258282421796880@lid",
                "body": "SIM",
                "fromMe": False,
                "_data": {"key": {"remoteJidAlt": f"{TELEFONE}@s.whatsapp.net"}},
            }
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google"),
                patch("apps.notificacoes.inbound.enviar_texto"),
            ):
                registrar_resposta(schema, payload)

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_sim_sem_confirmacao_pendente_e_ignorado():
    """'SIM' de um paciente para quem NÃO enviamos confirmação é ignorado."""
    clinica = _criar_clinica("gatilho_sempend_tenant", "gatilhosempend.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada(com_envio=False)
            payload = {"from": f"{TELEFONE}@c.us", "body": "sim", "fromMe": False}
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google") as mock_task,
                patch("apps.notificacoes.inbound.enviar_texto") as mock_envia,
            ):
                log = registrar_resposta(schema, payload)

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "PENDENTE"
            assert log is None
            mock_task.delay.assert_not_called()
            mock_envia.assert_not_called()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_sim_de_outro_numero_nao_confirma():
    """'SIM' de um telefone diferente do paciente não confirma a consulta dele."""
    clinica = _criar_clinica("gatilho_outronum_tenant", "gatilhooutronum.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            payload = {"from": "5511900000000@c.us", "body": "sim", "fromMe": False}
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google"),
                patch("apps.notificacoes.inbound.enviar_texto"),
            ):
                log = registrar_resposta(schema, payload)

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "PENDENTE"
            assert log is None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_reply_a_outra_mensagem_sem_comando_e_ignorado():
    """Cita outra mensagem (não a confirmação) com texto que não é comando -> ignora."""
    clinica = _criar_clinica("gatilho_replyunk_tenant", "gatilhoreplyunk.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google"),
                patch("apps.notificacoes.inbound.enviar_texto"),
            ):
                log = registrar_resposta(schema, _payload("bom dia", reply_to="OUTRA-MSG"))

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "PENDENTE"
            assert log is None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_sim_sem_remetente_identificavel_e_ignorado():
    """'SIM' sem `from`/remoteJidAlt (número não identificável) -> ignorado."""
    clinica = _criar_clinica("gatilho_semnum_tenant", "gatilhosemnum.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            payload = {"body": "sim", "fromMe": False}  # sem from/replyTo/_data
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google"),
                patch("apps.notificacoes.inbound.enviar_texto"),
            ):
                log = registrar_resposta(schema, payload)

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "PENDENTE"
            assert log is None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_reply_to_como_objeto_tambem_casa():
    """O replyTo pode vir como objeto ({'id': ...}); mesmo assim deve casar."""
    clinica = _criar_clinica("gatilho_obj_tenant", "gatilhoobj.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            payload = {
                "from": f"{TELEFONE}@c.us",
                "body": "Sim",
                "fromMe": False,
                "replyTo": {"id": MSG_ID},
            }
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google"),
                patch("apps.notificacoes.inbound.enviar_texto"),
            ):
                log = registrar_resposta(schema, payload)

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            assert log.direcao == "RECEBIDA"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_confirma_sem_sessao_configurada_nao_agradece():
    """Sem sessão WAHA configurada, confirma mas não tenta enviar agradecimento."""
    clinica = _criar_clinica("gatilho_semsess_tenant", "gatilhosemsess.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada(session="")
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google"),
                patch("apps.notificacoes.inbound.enviar_texto") as mock_envia,
            ):
                registrar_resposta(schema, _payload("Sim"))

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            mock_envia.assert_not_called()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_confirma_persiste_mesmo_se_agradecimento_falha():
    """Falha no envio do agradecimento não desfaz a confirmação; loga ERRO."""
    clinica = _criar_clinica("gatilho_falha_tenant", "gatilhofalha.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google"),
                patch(
                    "apps.notificacoes.inbound.enviar_texto",
                    side_effect=RequestException("timeout"),
                ),
            ):
                registrar_resposta(schema, _payload("Sim"))

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            assert LogNotificacao.objects.filter(
                direcao=LogNotificacao.Direcao.ENVIADA,
                status=LogNotificacao.Status.ERRO,
            ).exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
