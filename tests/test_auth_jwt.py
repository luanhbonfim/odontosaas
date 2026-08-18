"""Testes da autenticação JWT (login por e-mail, proteção dos endpoints, refresh)."""

import pytest
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio
from apps.usuarios.models import Usuario
from apps.usuarios.perfis import sincronizar_grupos


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_fluxo_jwt_completo():
    host = "apiauth.localhost"
    clinica = _criar_clinica("api_auth", host)
    try:
        with schema_context("api_auth"):
            sincronizar_grupos()  # cria os grupos; o usuário (RECEPCAO) recebe acesso
            Usuario.objects.create_user(email="dono@clinica.com", password="Senha12345")

        client = APIClient()  # cru (sem auto-autenticação, via marcador no_auto_auth)

        # 1) Sem token -> 401 (endpoint protegido)
        assert client.get("/api/pacientes/", HTTP_HOST=host).status_code == 401

        # 2) Login com credenciais válidas -> access + refresh
        resp = client.post(
            "/api/auth/token/",
            {"email": "dono@clinica.com", "password": "Senha12345"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 200, resp.content
        access = resp.json()["access"]
        refresh = resp.json()["refresh"]

        # 3) Credenciais inválidas -> 401
        assert (
            client.post(
                "/api/auth/token/",
                {"email": "dono@clinica.com", "password": "errada"},
                format="json",
                HTTP_HOST=host,
            ).status_code
            == 401
        )

        # 4) Com o token Bearer -> 200
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        assert client.get("/api/pacientes/", HTTP_HOST=host).status_code == 200

        # 5) Refresh -> novo access
        client.credentials()  # limpa o header
        r = client.post(
            "/api/auth/token/refresh/", {"refresh": refresh}, format="json", HTTP_HOST=host
        )
        assert r.status_code == 200 and "access" in r.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
