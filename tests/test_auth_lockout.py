"""Testes do bloqueio de login por tentativas malsucedidas (força bruta)."""

import pytest
from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio
from apps.usuarios.models import Usuario


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_bloqueia_por_ip_apos_5_tentativas():
    host = "lockout.localhost"
    clinica = _criar_clinica("lockout", host)
    cache.clear()
    try:
        with schema_context("lockout"):
            Usuario.objects.create_user(email="dono@clinica.com", password="Senha12345")

        client = APIClient()

        # 5 tentativas do MESMO IP, cada uma com um e-mail diferente -> 401.
        # (o bloqueio é por IP, não por conta)
        for i in range(5):
            resp = client.post(
                "/api/auth/token/",
                {"email": f"invasor{i}@x.com", "password": "errada"},
                format="json",
                HTTP_HOST=host,
                HTTP_X_FORWARDED_FOR="203.0.113.7",
            )
            assert resp.status_code == 401, resp.content

        # 6ª tentativa do mesmo IP, com conta e senha VÁLIDAS -> 429 (IP bloqueado)
        bloqueado = client.post(
            "/api/auth/token/",
            {"email": "dono@clinica.com", "password": "Senha12345"},
            format="json",
            HTTP_HOST=host,
            HTTP_X_FORWARDED_FOR="203.0.113.7",
        )
        assert bloqueado.status_code == 429, bloqueado.content

        # De OUTRO IP, o login válido continua funcionando -> 200
        ok = client.post(
            "/api/auth/token/",
            {"email": "dono@clinica.com", "password": "Senha12345"},
            format="json",
            HTTP_HOST=host,
            HTTP_X_FORWARDED_FOR="198.51.100.20",
        )
        assert ok.status_code == 200, ok.content
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_login_bem_sucedido_zera_contador():
    host = "lockout2.localhost"
    clinica = _criar_clinica("lockout2", host)
    cache.clear()
    try:
        with schema_context("lockout2"):
            Usuario.objects.create_user(email="dono@clinica.com", password="Senha12345")

        client = APIClient()
        errada = {"email": "dono@clinica.com", "password": "errada"}
        certa = {"email": "dono@clinica.com", "password": "Senha12345"}

        # 4 falhas (abaixo do limite) -> 401
        for _ in range(4):
            assert (
                client.post("/api/auth/token/", errada, format="json", HTTP_HOST=host).status_code
                == 401
            )

        # Sucesso zera o contador -> 200
        assert (
            client.post("/api/auth/token/", certa, format="json", HTTP_HOST=host).status_code == 200
        )

        # Após o sucesso, novas 4 falhas ainda NÃO bloqueiam (contador reiniciado)
        for _ in range(4):
            assert (
                client.post("/api/auth/token/", errada, format="json", HTTP_HOST=host).status_code
                == 401
            )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()
