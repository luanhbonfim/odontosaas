"""Testes do vínculo Dentista <-> Usuario (login do profissional)."""

import pytest
from django.contrib.auth import authenticate
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_criar_login_do_dentista():
    host = "login.localhost"
    clinica = _criar_clinica("login_tenant", host)
    client = APIClient()
    try:
        dentista = client.post(
            "/api/dentistas/",
            {"nome_completo": "Dra. Ana", "cro": "CRO-9"},
            format="json",
            HTTP_HOST=host,
        ).json()
        did = dentista["id"]
        base = f"/api/dentistas/{did}/criar-login/"

        # Sem email/senha -> 400
        assert client.post(base, {}, format="json", HTTP_HOST=host).status_code == 400

        # Cria o login -> 201 e vincula
        resp = client.post(
            base,
            {"email": "ana@x.com", "senha": "senha-forte-123"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        assert resp.json()["usuario"] is not None

        # Já possui login -> 400
        resp = client.post(
            base, {"email": "outro@x.com", "senha": "x123"}, format="json", HTTP_HOST=host
        )
        assert resp.status_code == 400

        # Outro dentista não pode usar o mesmo e-mail -> 400
        d2 = client.post(
            "/api/dentistas/",
            {"nome_completo": "Dr. B", "cro": "CRO-10"},
            format="json",
            HTTP_HOST=host,
        ).json()
        resp = client.post(
            f"/api/dentistas/{d2['id']}/criar-login/",
            {"email": "ana@x.com", "senha": "x123"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400

        # O login criado autentica com papel DENTISTA
        with schema_context(clinica.schema_name):
            user = authenticate(username="ana@x.com", password="senha-forte-123")
            assert user is not None
            assert user.papel == "DENTISTA"
            assert user.dentista.cro == "CRO-9"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
