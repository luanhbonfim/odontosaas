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
from apps.notificacoes.inbound import _palavras, interpretar_resposta, registrar_resposta
from apps.notificacoes.models import ConfiguracaoNotificacao, LogNotificacao, TemplateMensagem
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio

TELEFONE = "5511999998888"
MSG_ID = "WAHA-MSG-CONFIRMACAO-1"


def test_gatilho_configuravel():
    """Palavras do gatilho vêm do config (substituem o padrão) e são normalizadas."""
    confirma = {"beleza", "ok"}
    recusa = {"jamais"}
    assert interpretar_resposta("beleza", confirma, recusa) == "CONFIRMA"
    assert interpretar_resposta("JAMAIS", confirma, recusa) == "RECUSA"
    # Com palavras customizadas, o padrão ("sim") deixa de valer.
    assert interpretar_resposta("sim", confirma, recusa) is None
    # Sem config -> usa o padrão do sistema.
    assert interpretar_resposta("sim") == "CONFIRMA"
    # _palavras: vazio -> padrão; preenchido -> normaliza (acentos/caixa/espaços).
    assert _palavras("", {"sim"}) == {"sim"}
    assert _palavras("Sim, Ok , Confírmo", set()) == {"sim", "ok", "confirmo"}


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


def _payload_gows(body):
    """Resposta no formato GOWS: `from` é um LID e o telefone real vem em
    `_data.Info.SenderAlt` (sem `replyTo` — paciente só digitou a palavra)."""
    return {
        "from": "198333117284578@lid",
        "body": body,
        "fromMe": False,
        "replyTo": None,
        "_data": {"Info": {"Sender": "198333117284578@lid", "SenderAlt": f"{TELEFONE}@s.whatsapp.net"}},
    }


@pytest.mark.django_db(transaction=True)
def test_confirma_via_gows_lid_casa_por_senderalt():
    """GOWS: `from` é LID; casa pelo telefone em `_data.Info.SenderAlt` e confirma.
    O agradecimento usa o template AGRADECIMENTO (renderizado)."""
    clinica = _criar_clinica("gatilho_gows_tenant", "gatilhogows.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            TemplateMensagem.objects.create(
                tipo=TemplateMensagem.Tipo.AGRADECIMENTO, corpo="Valeu {{paciente}}!", ativo=True
            )
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google"),
                patch("apps.notificacoes.inbound.enviar_texto") as mock_envia,
            ):
                log = registrar_resposta(schema, _payload_gows("Sim"))

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            assert log is not None
            # Agradecimento usou o template renderizado (não o texto fixo).
            assert "Valeu Ana!" in mock_envia.call_args[0][2]
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_confirma_via_gows_senderalt_com_sufixo_dispositivo():
    """GOWS entrega o SenderAlt como '<numero>:<dispositivo>@servidor' (ex.:
    '5518...:93@s.whatsapp.net'). O ':93' NÃO pode entrar no número, senão não
    casa com o telefone do paciente."""
    clinica = _criar_clinica("gatilho_disp_tenant", "gatilhodisp.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            payload = {
                "from": "198333117284578@lid",
                "body": "SIM",
                "fromMe": False,
                "replyTo": None,
                "_data": {"Info": {"SenderAlt": f"{TELEFONE}:93@s.whatsapp.net"}},
            }
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google"),
                patch("apps.notificacoes.inbound.enviar_texto"),
            ):
                log = registrar_resposta(schema, payload)

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            assert log is not None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_confirma_atualiza_status_e_agradece():
    clinica = _criar_clinica("gatilho_ok_tenant", "gatilhook.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            with patch("apps.notificacoes.inbound.enviar_texto") as mock_envia:
                log = registrar_resposta(schema, _payload("Sim"))

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            assert consulta.confirmado_em is not None
            # A cor/estado no Google é refletida pela sync periódica (não imediata).
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
            assert consulta.status == "CANCELADA"  # recusa cancela e libera o horário
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
def test_reforca_quando_resposta_nao_e_sim_ou_nao():
    """Resposta que não é sim/não (com confirmação pendente) -> reenvia o pedido
    de responder apenas SIM/NÃO, com 'digitando' antes. Status não muda."""
    clinica = _criar_clinica("gatilho_ref_tenant", "gatilhoref.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            payload = {"from": f"{TELEFONE}@c.us", "body": "quem é?", "fromMe": False}
            with (
                patch("apps.notificacoes.inbound.enviar_digitando") as mock_typ,
                patch("apps.notificacoes.inbound.enviar_texto", return_value={"id": "r"}) as mock_env,
            ):
                registrar_resposta(schema, payload)

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "PENDENTE"  # não muda
            mock_typ.assert_called_once()  # efeito "digitando"
            mock_env.assert_called_once()
            assert "SIM" in mock_env.call_args[0][2].upper()
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
            with patch("apps.notificacoes.inbound.enviar_texto") as mock_envia:
                log = registrar_resposta(schema, payload)

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "CONFIRMADA"
            mock_envia.assert_called_once()  # agradecimento
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
def test_reply_a_outra_mensagem_sem_comando_reforca():
    """Texto que não é comando, com confirmação pendente -> reforça (W1). Não muda
    o status; o pedido de responder SIM/NÃO é reenviado."""
    clinica = _criar_clinica("gatilho_replyunk_tenant", "gatilhoreplyunk.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            with (
                patch("apps.notificacoes.inbound.enviar_digitando"),
                patch("apps.notificacoes.inbound.enviar_texto", return_value={"id": "r"}) as mock_env,
            ):
                log = registrar_resposta(schema, _payload("bom dia", reply_to="OUTRA-MSG"))

            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "PENDENTE"
            assert log is not None
            mock_env.assert_called_once()
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


@pytest.mark.django_db(transaction=True)
def test_confirma_casa_com_confirmacao_mais_recente():
    """2 consultas pendentes do mesmo número + 'sim' sem citar -> confirma a da
    confirmação MAIS RECENTE enviada (a outra fica pendente)."""
    clinica = _criar_clinica("gatilho_recente_tenant", "gatilhorecente.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            ConfiguracaoNotificacao.objects.create(waha_session="s", ativo=True)
            paciente = Paciente.objects.create(
                nome_completo="Ana", cpf="55511122233", telefone_whatsapp=TELEFONE
            )
            dentista = Dentista.objects.create(nome_completo="Dr", cro="CRO-R1")
            agora = timezone.now()
            ca = Consulta.objects.create(
                paciente=paciente,
                dentista=dentista,
                inicio=agora + timedelta(days=1),
                fim=agora + timedelta(days=1, minutes=30),
            )
            cb = Consulta.objects.create(
                paciente=paciente,
                dentista=dentista,
                inicio=agora + timedelta(days=7),
                fim=agora + timedelta(days=7, minutes=30),
            )
            LogNotificacao.objects.create(
                consulta=ca,
                direcao=LogNotificacao.Direcao.ENVIADA,
                status=LogNotificacao.Status.ENVIADA,
                provider_message_id="A",
            )
            LogNotificacao.objects.create(
                consulta=cb,
                direcao=LogNotificacao.Direcao.ENVIADA,
                status=LogNotificacao.Status.ENVIADA,
                provider_message_id="B",
            )
            with (
                patch("apps.notificacoes.inbound.sincronizar_evento_google"),
                patch("apps.notificacoes.inbound.enviar_texto"),
            ):
                registrar_resposta(schema, _payload_gows("Sim"))
            ca.refresh_from_db()
            cb.refresh_from_db()
            assert cb.status_confirmacao == "CONFIRMADA"  # a mais recente enviada
            assert ca.status_confirmacao == "PENDENTE"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_recusa_dispara_task_de_cancelamento(cancelamento_task_mock):
    clinica = _criar_clinica("gatilho_reccancel_tenant", "gatilhoreccancel.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            consulta = _consulta_com_confirmacao_enviada()
            with patch("apps.notificacoes.inbound.sincronizar_evento_google"):
                registrar_resposta(schema, _payload("Nao"))
            consulta.refresh_from_db()
            assert consulta.status_confirmacao == "RECUSADA"
            assert consulta.status == "CANCELADA"
        cancelamento_task_mock.delay.assert_called_once()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_cancelamento_manual_dispara_task(cancelamento_task_mock):
    clinica = _criar_clinica("cancel_manual_tenant", "cancelmanual.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            paciente = Paciente.objects.create(
                nome_completo="Zé", cpf="11122233344", telefone_whatsapp=TELEFONE
            )
            dentista = Dentista.objects.create(nome_completo="Dr", cro="CRO-C1")
            inicio = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=paciente, dentista=dentista, inicio=inicio, fim=inicio + timedelta(minutes=30)
            )
            consulta.status = Consulta.Status.CANCELADA
            consulta.save(update_fields=["status", "atualizado_em"])
        cancelamento_task_mock.delay.assert_called_once()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_enviar_cancelamento_usa_template():
    from apps.notificacoes.models import TemplateMensagem
    from apps.notificacoes.tasks import enviar_cancelamento

    clinica = _criar_clinica("cancel_tpl_tenant", "canceltpl.localhost")
    schema = clinica.schema_name
    try:
        with schema_context(schema):
            ConfiguracaoNotificacao.objects.create(waha_session="s", ativo=True)
            TemplateMensagem.objects.create(
                tipo=TemplateMensagem.Tipo.CANCELAMENTO, corpo="Cancelada, {{paciente}}.", ativo=True
            )
            paciente = Paciente.objects.create(
                nome_completo="Ana", cpf="55511122233", telefone_whatsapp=TELEFONE
            )
            dentista = Dentista.objects.create(nome_completo="Dr", cro="CRO-T1")
            inicio = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=paciente, dentista=dentista, inicio=inicio, fim=inicio + timedelta(minutes=30)
            )
            with (
                patch("apps.notificacoes.tasks.enviar_texto") as mock_envia,
                patch("apps.notificacoes.tasks.garantir_sessao"),
            ):
                log = enviar_cancelamento(consulta)
            assert log.status == LogNotificacao.Status.ENVIADA
            assert "Cancelada, Ana." in mock_envia.call_args[0][2]
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
