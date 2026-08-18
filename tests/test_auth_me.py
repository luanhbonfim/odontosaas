"""Testes do endpoint /api/auth/me/ (dados do usuário logado + clínica)."""

import pytest
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio
from apps.usuarios.models import Usuario


def _criar_clinica(schema, dominio, nome):
    clinica = Clinica(schema_name=schema, nome_fantasia=nome)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_me_retorna_usuario_e_clinica():
    host = "me.localhost"
    clinica = _criar_clinica("me_tenant", host, "Clínica Sorriso")
    try:
        with schema_context("me_tenant"):
            Usuario.objects.create_user(
                email="dra@clinica.com",
                password="Senha12345",
                nome_completo="Dra. Ana",
                papel=Usuario.Papel.DENTISTA,
            )

        client = APIClient()

        # Sem token -> 401 (o frontend usa isso para detectar sessão inválida)
        assert client.get("/api/auth/me/", HTTP_HOST=host).status_code == 401

        # Login e chamada autenticada
        resp = client.post(
            "/api/auth/token/",
            {"email": "dra@clinica.com", "password": "Senha12345"},
            format="json",
            HTTP_HOST=host,
        )
        access = resp.json()["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        r = client.get("/api/auth/me/", HTTP_HOST=host)
        assert r.status_code == 200, r.content
        dados = r.json()
        assert dados["email"] == "dra@clinica.com"
        assert dados["nome_completo"] == "Dra. Ana"
        assert dados["papel"] == "DENTISTA"
        assert dados["papel_display"] == "Dentista"
        assert dados["clinica"] == {"schema": "me_tenant", "nome_fantasia": "Clínica Sorriso"}
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
