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


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_cross_tenant_token_rejeitado():
    """Garante que um token emitido para o tenant A seja rejeitado ao acessar o tenant B."""
    host_a = "tenant-a.localhost"
    host_b = "tenant-b.localhost"
    clinica_a = _criar_clinica("tenant_a_tok", host_a)
    clinica_b = _criar_clinica("tenant_b_tok", host_b)
    try:
        with schema_context("tenant_a_tok"):
            sincronizar_grupos()
            Usuario.objects.create_user(email="user@a.com", password="Senha12345")

        with schema_context("tenant_b_tok"):
            sincronizar_grupos()
            Usuario.objects.create_user(email="user@b.com", password="Senha12345")

        client = APIClient()
        resp_a = client.post(
            "/api/auth/token/",
            {"email": "user@a.com", "password": "Senha12345"},
            format="json",
            HTTP_HOST=host_a,
        )
        assert resp_a.status_code == 200
        token_a = resp_a.json()["access"]

        # Tenta usar o token do Tenant A no Tenant B
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_a}")
        resp_b = client.get("/api/pacientes/", HTTP_HOST=host_b)
        assert resp_b.status_code in (401, 403)
    finally:
        connection.set_schema_to_public()
        clinica_a.delete(force_drop=True)
        clinica_b.delete(force_drop=True)

