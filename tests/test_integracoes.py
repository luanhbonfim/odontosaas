"""Testes do app integracoes (CredencialGoogleCalendar + criptografia de tokens)."""

import pytest
from django.db import connection
from django_tenants.utils import schema_context

from apps.core.fields import EncryptedTextField
from apps.core.models import ModeloBase
from apps.integracoes.models import CredencialGoogleCalendar
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_integracoes_config(settings):
    assert "apps.integracoes" in settings.TENANT_APPS
    assert issubclass(CredencialGoogleCalendar, ModeloBase)
    assert isinstance(CredencialGoogleCalendar._meta.get_field("access_token"), EncryptedTextField)


def test_str():
    from apps.dentistas.models import Dentista

    assert str(CredencialGoogleCalendar()) == "Google Calendar (Clínica)"
    cred = CredencialGoogleCalendar(dentista=Dentista(nome_completo="Dr. X"))
    assert str(cred) == "Google Calendar (Dr. X)"


# --- Criptografia real em repouso ---
@pytest.mark.django_db(transaction=True)
def test_tokens_ficam_criptografados_no_banco():
    clinica = _criar_clinica("integracoes_tenant", "integracoes.localhost")
    try:
        with schema_context(clinica.schema_name):
            cred = CredencialGoogleCalendar.objects.create(
                access_token="segredo-access-123",
                refresh_token="segredo-refresh-456",
                scope="calendar.events",
            )

            # Ao reler pelo ORM, o valor volta descriptografado
            cred.refresh_from_db()
            assert cred.access_token == "segredo-access-123"
            assert cred.refresh_token == "segredo-refresh-456"

            # No banco (valor cru), NÃO está em texto puro
            with connection.cursor() as cur:
                cur.execute(
                    "SELECT access_token FROM integracoes_credencialgooglecalendar WHERE id = %s",
                    [cred.id],
                )
                bruto = cur.fetchone()[0]
            assert bruto != "segredo-access-123"
            assert "segredo-access-123" not in bruto

            # Tokens vazios: grava e relê "" sem criptografar
            vazio = CredencialGoogleCalendar.objects.create()
            vazio.refresh_from_db()
            assert vazio.access_token == ""

            # Valor legado (texto puro no banco): from_db_value devolve como está
            with connection.cursor() as cur:
                cur.execute(
                    "UPDATE integracoes_credencialgooglecalendar SET access_token = %s WHERE id = %s",
                    ["texto-puro-legado", cred.id],
                )
            cred.refresh_from_db()
            assert cred.access_token == "texto-puro-legado"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
