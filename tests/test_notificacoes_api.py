"""Testes da API de notificações: envio manual de confirmação + histórico."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def test_normalizar_numero_br():
    """DDD+número ganha o DDI 55; número completo fica igual; curto é inválido."""
    from apps.notificacoes.waha import normalizar_numero, numero_valido

    assert normalizar_numero("(18) 99690-2466") == "5518996902466"
    assert normalizar_numero("18996902466") == "5518996902466"
    assert normalizar_numero("5518996902466") == "5518996902466"  # já tem DDI
    assert numero_valido("18996902466") is True
    assert numero_valido("") is False
    assert numero_valido("99999") is False


@pytest.mark.django_db(transaction=True)
def test_envio_manual_numero_invalido_e_erro_waha():
    from unittest.mock import patch

    from requests import RequestException

    from apps.agenda.models import Consulta
    from apps.dentistas.models import Dentista
    from apps.notificacoes.models import ConfiguracaoNotificacao, TemplateMensagem
    from apps.pacientes.models import Paciente

    host = "notiferr.localhost"
    clinica = _criar_clinica("notiferr_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            ConfiguracaoNotificacao.objects.create(ativo=True, waha_session="notiferr_tenant")
            TemplateMensagem.objects.create(
                tipo=TemplateMensagem.Tipo.CONFIRMACAO, corpo="Oi {{paciente}}", ativo=True
            )
            den = Dentista.objects.create(nome_completo="Dra", cro="CRO-E9")
            inicio = timezone.now() + timedelta(days=1)
            # Paciente SEM número válido (curto).
            ruim = Paciente.objects.create(
                nome_completo="Sem Zap", cpf="11122233344", telefone_whatsapp="99999"
            )
            c_ruim = Consulta.objects.create(
                paciente=ruim, dentista=den, inicio=inicio, fim=inicio + timedelta(minutes=30)
            ).id
            bom = Paciente.objects.create(
                nome_completo="Com Zap", cpf="55566677788", telefone_whatsapp="18996902466"
            )
            c_bom = Consulta.objects.create(
                paciente=bom, dentista=den, inicio=inicio, fim=inicio + timedelta(minutes=30)
            ).id

        # Número inválido -> 400 com mensagem clara (sem nem chamar o WAHA).
        r = client.post(
            "/api/logs-notificacao/enviar-confirmacao/",
            {"consulta": c_ruim},
            format="json",
            HTTP_HOST=host,
        )
        assert r.status_code == 400
        assert "whatsapp" in r.json()["detail"].lower()

        # Número ok, mas o WAHA falha (ex.: "no LID found") -> 400 com motivo legível.
        with (
            patch("apps.notificacoes.tasks.garantir_sessao", return_value=True),
            patch(
                "apps.notificacoes.tasks.enviar_texto",
                side_effect=RequestException("500 ... no LID found for 18996902466"),
            ),
        ):
            r = client.post(
                "/api/logs-notificacao/enviar-confirmacao/",
                {"consulta": c_bom},
                format="json",
                HTTP_HOST=host,
            )
        assert r.status_code == 400
        assert "inválido" in r.json()["detail"].lower() or "whatsapp" in r.json()["detail"].lower()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_envio_manual_e_historico():
    from apps.agenda.models import Consulta
    from apps.dentistas.models import Dentista
    from apps.notificacoes.models import ConfiguracaoNotificacao, TemplateMensagem
    from apps.pacientes.models import Paciente

    host = "notif.localhost"
    clinica = _criar_clinica("notif_tenant", host)
    client = APIClient()  # auto-autenticado (conftest, superuser)
    try:
        with schema_context(clinica.schema_name):
            ConfiguracaoNotificacao.objects.create(ativo=True, waha_session="s1")
            TemplateMensagem.objects.create(
                tipo=TemplateMensagem.Tipo.CONFIRMACAO,
                corpo="Oi {{paciente}}, dia {{data}} às {{hora}}",
                ativo=True,
            )
            pac = Paciente.objects.create(
                nome_completo="Zé", cpf="11122233344", telefone_whatsapp="5511999998888"
            )
            den = Dentista.objects.create(nome_completo="Dr. Um", cro="CRO-N1")
            inicio = timezone.now() + timedelta(days=1)
            consulta_id = Consulta.objects.create(
                paciente=pac, dentista=den, inicio=inicio, fim=inicio + timedelta(minutes=30)
            ).id

        # Envio manual (WAHA mockado) -> 201 e status ENVIADA.
        with (
            patch("apps.notificacoes.tasks.enviar_texto", return_value={"id": "m1"}),
            patch("apps.notificacoes.tasks.garantir_sessao", return_value=True),
        ):
            resp = client.post(
                "/api/logs-notificacao/enviar-confirmacao/",
                {"consulta": consulta_id},
                format="json",
                HTTP_HOST=host,
            )
        assert resp.status_code == 201, resp.content
        assert resp.json()["status"] == "ENVIADA"
        assert "Zé" in resp.json()["mensagem"]  # variável {{paciente}} renderizada

        # Histórico lista o envio, com nome do paciente e tipo do template.
        logs = client.get("/api/logs-notificacao/", HTTP_HOST=host).json()
        assert len(logs) == 1
        assert logs[0]["paciente_nome"] == "Zé"
        assert logs[0]["tipo"] == "CONFIRMACAO"
        assert logs[0]["direcao"] == "ENVIADA"

        # Filtro por status.
        assert len(client.get("/api/logs-notificacao/?status=ENVIADA", HTTP_HOST=host).json()) == 1
        assert client.get("/api/logs-notificacao/?status=ERRO", HTTP_HOST=host).json() == []
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_whatsapp_pareamento_status_qr_desconectar():
    from apps.notificacoes.models import ConfiguracaoNotificacao

    host = "wa.localhost"
    clinica = _criar_clinica("wa_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            ConfiguracaoNotificacao.objects.create(ativo=True)

        # Status conectado (WORKING) -> sessão = schema do tenant; número do `me.id`.
        with patch(
            "apps.notificacoes.waha.status_sessao",
            return_value={"status": "WORKING", "me": {"id": "5511999@c.us"}},
        ):
            r = client.get("/api/config-notificacao/whatsapp/", HTTP_HOST=host)
        assert r.status_code == 200
        assert r.json() == {
            "session": "wa_tenant",
            "status": "WORKING",
            "conectado": True,
            "numero": "5511999",
        }

        # Conectar -> inicia a sessão e devolve o status (aguardando QR).
        with (
            patch("apps.notificacoes.waha.garantir_sessao", return_value=True),
            patch(
                "apps.notificacoes.waha.status_sessao",
                return_value={"status": "SCAN_QR_CODE", "me": None},
            ),
        ):
            r = client.post("/api/config-notificacao/whatsapp-conectar/", {}, format="json", HTTP_HOST=host)
        assert r.status_code == 200 and r.json()["status"] == "SCAN_QR_CODE"

        # QR como data URI.
        with patch("apps.notificacoes.waha.obter_qr", return_value="data:image/png;base64,AAAA"):
            r = client.get("/api/config-notificacao/whatsapp-qr/", HTTP_HOST=host)
        assert r.status_code == 200 and r.json()["qr"].startswith("data:image/png;base64,")

        # Desconectar (logout).
        with patch("apps.notificacoes.waha.encerrar_sessao", return_value=True):
            r = client.post("/api/config-notificacao/whatsapp-desconectar/", {}, format="json", HTTP_HOST=host)
        assert r.status_code == 200 and r.json()["status"] == "desconectado"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_whatsapp_sessao_automatica_por_tenant():
    """Sem config, conectar cria a config com a sessão = schema do tenant."""
    from apps.notificacoes.models import ConfiguracaoNotificacao

    host = "waauto.localhost"
    clinica = _criar_clinica("waauto_tenant", host)
    client = APIClient()
    try:
        with (
            patch("apps.notificacoes.waha.garantir_sessao", return_value=True),
            patch(
                "apps.notificacoes.waha.status_sessao",
                return_value={"status": "SCAN_QR_CODE", "me": None},
            ),
        ):
            r = client.post(
                "/api/config-notificacao/whatsapp-conectar/", {}, format="json", HTTP_HOST=host
            )
        assert r.status_code == 200 and r.json()["status"] == "SCAN_QR_CODE"

        # A config foi criada com a sessão = schema do tenant.
        with schema_context(clinica.schema_name):
            config = ConfiguracaoNotificacao.objects.get()
            assert config.waha_session == "waauto_tenant"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_config_campos_extra_round_trip():
    from apps.notificacoes.models import ConfiguracaoNotificacao

    host = "notifcfg.localhost"
    clinica = _criar_clinica("notifcfg_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            cid = ConfiguracaoNotificacao.objects.create().id

        resp = client.patch(
            f"/api/config-notificacao/{cid}/",
            {
                "numero_clinica": "5511999998888",
                "palavras_confirmacao": "beleza, ok",
                "palavras_recusa": "jamais",
                "enviar_agradecimento": False,
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 200, resp.content
        corpo = resp.json()
        assert corpo["numero_clinica"] == "5511999998888"
        assert corpo["palavras_confirmacao"] == "beleza, ok"
        assert corpo["enviar_agradecimento"] is False
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_envio_manual_sem_config_da_400():
    from apps.agenda.models import Consulta
    from apps.dentistas.models import Dentista
    from apps.pacientes.models import Paciente

    host = "notifsemcfg.localhost"
    clinica = _criar_clinica("notifsemcfg_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            pac = Paciente.objects.create(
                nome_completo="Ana", cpf="55566677788", telefone_whatsapp="5511"
            )
            den = Dentista.objects.create(nome_completo="Dra", cro="CRO-N2")
            inicio = timezone.now() + timedelta(days=1)
            cid = Consulta.objects.create(
                paciente=pac, dentista=den, inicio=inicio, fim=inicio + timedelta(minutes=30)
            ).id

        # Sem configuração/template ativo -> 400 com mensagem clara.
        resp = client.post(
            "/api/logs-notificacao/enviar-confirmacao/",
            {"consulta": cid},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "template" in resp.json()["detail"].lower()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_confirmacao_por_link_publico():
    import uuid

    from apps.agenda.models import Consulta
    from apps.dentistas.models import Dentista
    from apps.notificacoes.models import ConfiguracaoNotificacao
    from apps.pacientes.models import Paciente

    host = "link.localhost"
    clinica = _criar_clinica("link_tenant", host)
    client = APIClient()
    try:
        token = uuid.uuid4()
        with schema_context(clinica.schema_name):
            ConfiguracaoNotificacao.objects.create(ativo=True, waha_session="link_tenant")
            pac = Paciente.objects.create(
                nome_completo="Zé", cpf="11122233344", telefone_whatsapp="5518996902466"
            )
            den = Dentista.objects.create(nome_completo="Dr", cro="CRO-L9")
            inicio = timezone.now() + timedelta(days=1)
            cid = Consulta.objects.create(
                paciente=pac,
                dentista=den,
                inicio=inicio,
                fim=inicio + timedelta(minutes=30),
                confirmacao_token=token,
            ).id

        # GET público: dados da consulta.
        r = client.get(f"/api/confirmacao/{token}/", HTTP_HOST=host)
        assert r.status_code == 200
        assert r.json()["paciente_nome"] == "Zé"
        assert r.json()["status_confirmacao"] == "PENDENTE"

        # POST confirmar -> CONFIRMADA (Google/agradecimento mockados).
        with (
            patch("apps.notificacoes.inbound.sincronizar_evento_google"),
            patch("apps.notificacoes.inbound.enviar_texto"),
        ):
            r = client.post(
                f"/api/confirmacao/{token}/", {"acao": "confirmar"}, format="json", HTTP_HOST=host
            )
        assert r.status_code == 200 and r.json()["status_confirmacao"] == "CONFIRMADA"
        with schema_context(clinica.schema_name):
            assert Consulta.objects.get(id=cid).status_confirmacao == "CONFIRMADA"

        # Token inexistente -> 404.
        assert client.get(f"/api/confirmacao/{uuid.uuid4()}/", HTTP_HOST=host).status_code == 404
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_confirmacao_manual_inclui_link(settings):
    from apps.agenda.models import Consulta
    from apps.dentistas.models import Dentista
    from apps.notificacoes.models import ConfiguracaoNotificacao, TemplateMensagem
    from apps.notificacoes.tasks import enviar_confirmacao_manual
    from apps.pacientes.models import Paciente

    settings.APP_BASE_URL = "https://clinica.example"
    host = "link2.localhost"
    clinica = _criar_clinica("link2_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            ConfiguracaoNotificacao.objects.create(ativo=True, waha_session="s")
            TemplateMensagem.objects.create(
                tipo=TemplateMensagem.Tipo.CONFIRMACAO, corpo="Oi {{paciente}}", ativo=True
            )
            pac = Paciente.objects.create(
                nome_completo="Ana", cpf="55566677788", telefone_whatsapp="5518996902466"
            )
            den = Dentista.objects.create(nome_completo="Dr", cro="CRO-L8")
            inicio = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=pac, dentista=den, inicio=inicio, fim=inicio + timedelta(minutes=30)
            )
            with (
                patch("apps.notificacoes.tasks.enviar_texto") as mock_envia,
                patch("apps.notificacoes.tasks.garantir_sessao"),
            ):
                enviar_confirmacao_manual(consulta)
            mensagem = mock_envia.call_args[0][2]
            consulta.refresh_from_db()
            assert consulta.confirmacao_token is not None
            assert f"https://clinica.example/c/{consulta.confirmacao_token}" in mensagem
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
