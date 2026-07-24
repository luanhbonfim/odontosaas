"""Testes do webhook de push notifications do Google + registro/renovação de canal."""

from unittest.mock import MagicMock, patch

import pytest
from django.db import connection
from django.test import Client
from django_tenants.utils import schema_context

from apps.integracoes.models import CredencialGoogleCalendar
from apps.integracoes.tasks import renovar_watch_channels
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _mock_watch_service():
    service = MagicMock()
    service.events.return_value.watch.return_value.execute.return_value = {
        "id": "canal-1",
        "resourceId": "recurso-1",
        "expiration": "32503680000000",  # ano ~3000 (ms)
    }
    return service


@pytest.mark.django_db(transaction=True)
def test_registrar_watch():
    from apps.integracoes.google_calendar import registrar_watch

    clinica = _criar_clinica("watch_tenant", "watch.localhost")
    try:
        with schema_context(clinica.schema_name):
            cred = CredencialGoogleCalendar.objects.create(access_token="tok")
            with patch(
                "apps.integracoes.google_calendar.build", return_value=_mock_watch_service()
            ):
                registrar_watch(cred, "https://watch.localhost/integracoes/google/webhook")
            cred.refresh_from_db()
            assert cred.watch_channel_id == "canal-1"
            assert cred.watch_resource_id == "recurso-1"
            assert cred.watch_expiration is not None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_webhook_dispara_sync_incremental():
    host = "webhook.localhost"
    clinica = _criar_clinica("webhook_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            CredencialGoogleCalendar.objects.create(access_token="tok", watch_channel_id="ch-9")

        client = Client()
        with patch("apps.integracoes.google_calendar.sincronizar_incremental") as mock_sync:
            # Notificação inicial "sync" -> não dispara
            resp = client.post(
                "/integracoes/google/webhook",
                HTTP_HOST=host,
                HTTP_X_GOOG_CHANNEL_ID="ch-9",
                HTTP_X_GOOG_RESOURCE_STATE="sync",
            )
            assert resp.status_code == 200
            assert mock_sync.call_count == 0

            # Mudança "exists" -> dispara o sync da credencial do canal
            resp = client.post(
                "/integracoes/google/webhook",
                HTTP_HOST=host,
                HTTP_X_GOOG_CHANNEL_ID="ch-9",
                HTTP_X_GOOG_RESOURCE_STATE="exists",
            )
            assert resp.status_code == 200
            assert mock_sync.call_count == 1
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_renovar_watch_channels():
    clinica = _criar_clinica("renovar_tenant", "renovar.localhost")
    # Clínica SEM domínio primário -> exercita o "continue" da task.
    sem_dominio = Clinica(schema_name="sem_dominio", nome_fantasia="Sem Domínio")
    sem_dominio.save()
    try:
        with schema_context(clinica.schema_name):
            # Credencial sem watch_expiration -> deve ser renovada
            CredencialGoogleCalendar.objects.create(access_token="tok")

        with patch("apps.integracoes.google_calendar.build", return_value=_mock_watch_service()):
            total = renovar_watch_channels()
        assert total >= 1

        with schema_context(clinica.schema_name):
            cred = CredencialGoogleCalendar.objects.get()
            assert cred.watch_channel_id == "canal-1"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        sem_dominio.delete(force_drop=True)
