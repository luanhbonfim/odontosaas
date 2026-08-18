"""Testes da API REST de integrações Google (status/sincronizar/desconectar)."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio

Usuario = get_user_model()


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_status_sincronizar_e_desconectar():
    from apps.agenda.models import AgendaEvento, Consulta
    from apps.dentistas.models import Dentista
    from apps.integracoes.models import CredencialGoogleCalendar
    from apps.pacientes.models import Paciente

    host = "integ.localhost"
    clinica = _criar_clinica("integ_tenant", host)
    client = APIClient()  # auto-autenticado (conftest, superuser)
    try:
        with schema_context(clinica.schema_name):
            dent = Dentista.objects.create(nome_completo="Dr. Um", cro="CRO-I1")
            paciente = Paciente.objects.create(nome_completo="Zé", cpf="11122233344")
            # Fora da janela de 24h para não cair na regra de não-confirmada.
            inicio = timezone.now() + timedelta(days=3)
            consulta = Consulta.objects.create(
                paciente=paciente, dentista=dent, inicio=inicio, fim=inicio + timedelta(minutes=30)
            )
            # Credencial conectada da CLÍNICA (dentista nulo).
            CredencialGoogleCalendar.objects.create(
                dentista=None, refresh_token="rt", access_token="at", scope="x"
            )

        # STATUS: clínica conectada; o dentista, não.
        linhas = client.get("/api/integracoes/google/conexoes/", HTTP_HOST=host).json()
        clinica_row = next(x for x in linhas if x["dentista"] is None)
        dent_row = next(x for x in linhas if x["dentista"] == dent.id)
        assert clinica_row["conectado"] is True
        assert dent_row["conectado"] is False

        # SINCRONIZAR (reconciliação): mocka a chamada ao Google -> cria o evento.
        def fake_sync(consulta_obj, credencial=None):
            evento, _ = AgendaEvento.objects.get_or_create(
                consulta=consulta_obj, credencial=credencial
            )
            evento.google_event_id = "gid-x"
            evento.status_sync = AgendaEvento.StatusSync.SINCRONIZADO
            evento.save()
            return evento

        with patch(
            "apps.integracoes.google_calendar.sincronizar_consulta", side_effect=fake_sync
        ):
            resp = client.post(
                "/api/integracoes/google/sincronizar/", {}, format="json", HTTP_HOST=host
            )
        assert resp.status_code == 200
        assert resp.json()["criados"] == 1

        # A consulta passa a expor sync_google = SINCRONIZADO.
        corpo = client.get(f"/api/consultas/{consulta.id}/", HTTP_HOST=host).json()
        assert corpo["sync_google"] == "SINCRONIZADO"

        # DESCONECTAR a clínica -> volta a "desconectado".
        desc = client.post(
            "/api/integracoes/google/desconectar/", {"dentista": None}, format="json", HTTP_HOST=host
        )
        assert desc.status_code == 200
        linhas2 = client.get("/api/integracoes/google/conexoes/", HTTP_HOST=host).json()
        assert next(x for x in linhas2 if x["dentista"] is None)["conectado"] is False
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_integracoes_so_gestor_acessa():
    from apps.usuarios.perfis import sincronizar_grupos

    host = "integperm.localhost"
    clinica = _criar_clinica("integperm_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(
                email="recep@c.com", password="Senha12345", papel="RECEPCAO"
            )
            Usuario.objects.create_user(
                email="ger@c.com", password="Senha12345", papel="DENTISTA_GERENTE"
            )

        def cliente(email):
            cache.clear()
            c = APIClient()
            tok = c.post(
                "/api/auth/token/",
                {"email": email, "password": "Senha12345"},
                format="json",
                HTTP_HOST=host,
            ).json()["access"]
            c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
            return c

        # Recepção não gerencia integrações (403); Gerente sim (200).
        assert (
            cliente("recep@c.com")
            .get("/api/integracoes/google/conexoes/", HTTP_HOST=host)
            .status_code
            == 403
        )
        assert (
            cliente("ger@c.com").get("/api/integracoes/google/conexoes/", HTTP_HOST=host).status_code
            == 200
        )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_dentista_ve_e_gerencia_so_a_sua_integracao():
    from apps.dentistas.models import Dentista
    from apps.integracoes.models import CredencialGoogleCalendar
    from apps.usuarios.perfis import sincronizar_grupos

    host = "integdent.localhost"
    clinica = _criar_clinica("integdent_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            dent = Dentista.objects.create(nome_completo="Dr. Meu", cro="CRO-M1")
            usuario = Usuario.objects.create_user(
                email="d@c.com", password="Senha12345", papel="DENTISTA"
            )
            dent.usuario = usuario
            dent.save(update_fields=["usuario"])
            Dentista.objects.create(nome_completo="Dr. Outro", cro="CRO-O1")
            CredencialGoogleCalendar.objects.create(dentista=None, refresh_token="rt")  # clínica

        cache.clear()
        client = APIClient()
        tok = client.post(
            "/api/auth/token/",
            {"email": "d@c.com", "password": "Senha12345"},
            format="json",
            HTTP_HOST=host,
        ).json()["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")

        # Vê SÓ a própria conexão (não a clínica nem outros dentistas).
        linhas = client.get("/api/integracoes/google/conexoes/", HTTP_HOST=host).json()
        assert len(linhas) == 1
        assert linhas[0]["dentista"] == dent.id

        # Não pode desconectar a clínica (403).
        assert (
            client.post(
                "/api/integracoes/google/desconectar/",
                {"dentista": None},
                format="json",
                HTTP_HOST=host,
            ).status_code
            == 403
        )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()
