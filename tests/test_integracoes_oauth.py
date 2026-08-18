"""Testes do fluxo OAuth2 do Google Calendar (com mock do Flow)."""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.db import connection
from django.test import Client
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.dentistas.models import Dentista
from apps.integracoes.models import CredencialGoogleCalendar
from apps.integracoes.views import SCOPES
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def test_get_flow_usa_a_configuracao(settings):
    """Exercita o get_flow real (sem mock): monta o Flow com o redirect_uri."""
    settings.GOOGLE_OAUTH_CLIENT_ID = "meu-client-id"
    settings.GOOGLE_OAUTH_CLIENT_SECRET = "meu-secret"
    from google_auth_oauthlib.flow import Flow

    from apps.integracoes.views import get_flow

    flow = get_flow(state="s1")
    assert isinstance(flow, Flow)
    assert flow.redirect_uri == settings.GOOGLE_OAUTH_REDIRECT_URI


def _mock_flow():
    flow = MagicMock()
    flow.authorization_url.return_value = (
        "https://accounts.google.com/o/oauth2/auth?client_id=x",
        "state-abc",
    )
    creds = MagicMock()
    creds.token = "access-token-xyz"
    creds.refresh_token = "refresh-token-xyz"
    creds.expiry = timezone.now() + timedelta(hours=1)
    creds.scopes = SCOPES
    flow.credentials = creds
    return flow


@pytest.mark.django_db(transaction=True)
def test_fluxo_oauth_completo_com_dentista():
    host = "oauth.localhost"
    clinica = _criar_clinica("oauth_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            den_id = Dentista.objects.create(nome_completo="Dr. G", cro="CRO-G").id

        client = Client()
        with patch("apps.integracoes.views.get_flow", return_value=_mock_flow()):
            # authorize -> 302 para o Google
            resp = client.get(f"/integracoes/google/authorize?dentista={den_id}", HTTP_HOST=host)
            assert resp.status_code == 302
            assert "accounts.google.com" in resp["Location"]

            # callback (mesmo client -> sessão carrega state + dentista); redireciona à SPA
            resp = client.get("/integracoes/google/callback?code=abc", HTTP_HOST=host)
            assert resp.status_code == 302
            assert resp["Location"].endswith("/integracoes?google=conectado")

        with schema_context(clinica.schema_name):
            cred = CredencialGoogleCalendar.objects.get()
            assert cred.dentista_id == den_id
            assert cred.access_token == "access-token-xyz"  # descriptografado ao reler
            assert cred.refresh_token == "refresh-token-xyz"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_callback_sem_dentista_cria_credencial_da_clinica():
    host = "oauth2.localhost"
    clinica = _criar_clinica("oauth2_tenant", host)
    try:
        client = Client()
        with patch("apps.integracoes.views.get_flow", return_value=_mock_flow()):
            resp = client.get("/integracoes/google/callback?code=abc", HTTP_HOST=host)
            assert resp.status_code == 302

        with schema_context(clinica.schema_name):
            cred = CredencialGoogleCalendar.objects.get()
            assert cred.dentista_id is None  # credencial da clínica
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
