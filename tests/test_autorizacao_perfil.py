"""Testes de autorização por perfil (grupos/permissões por tenant).

Verifica que a matriz de permissões é aplicada de fato pelo backend:
Recepção/Dentista não acessam Financeiro; Gerente/Admin acessam; e o nível de
leitura (Recepção vê Dentistas, mas não cria).
"""

import pytest
from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio
from apps.usuarios.models import Usuario
from apps.usuarios.perfis import sincronizar_grupos

HOST = "perfil.localhost"
SCHEMA = "perfil_tenant"
SENHA = "Senha12345"


def _setup():
    clinica = Clinica(schema_name=SCHEMA, nome_fantasia="Clínica Perfis")
    clinica.save()
    Dominio.objects.create(domain=HOST, tenant=clinica, is_primary=True)
    with schema_context(SCHEMA):
        sincronizar_grupos()
        for papel in ("RECEPCAO", "DENTISTA", "DENTISTA_GERENTE", "ADMIN"):
            Usuario.objects.create_user(email=f"{papel.lower()}@c.com", password=SENHA, papel=papel)
    return clinica


def _cliente(papel):
    cache.clear()  # evita o bloqueio por tentativas entre logins
    client = APIClient()
    resp = client.post(
        "/api/auth/token/",
        {"email": f"{papel.lower()}@c.com", "password": SENHA},
        format="json",
        HTTP_HOST=HOST,
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.json()['access']}")
    return client


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_matriz_de_permissoes_por_perfil():
    clinica = _setup()
    try:
        # Recepção: agenda ok, financeiro bloqueado
        recepcao = _cliente("RECEPCAO")
        assert recepcao.get("/api/consultas/", HTTP_HOST=HOST).status_code == 200
        assert recepcao.get("/api/faturas/", HTTP_HOST=HOST).status_code == 403
        # Recepção vê Dentistas (leitura), mas não pode criar
        assert recepcao.get("/api/dentistas/", HTTP_HOST=HOST).status_code == 200
        assert (
            recepcao.post(
                "/api/dentistas/",
                {"nome_completo": "X", "cro": "123"},
                format="json",
                HTTP_HOST=HOST,
            ).status_code
            == 403
        )

        # Dentista: financeiro bloqueado, agenda ok
        dentista = _cliente("DENTISTA")
        assert dentista.get("/api/faturas/", HTTP_HOST=HOST).status_code == 403
        assert dentista.get("/api/consultas/", HTTP_HOST=HOST).status_code == 200

        # Dentista Gerente e Admin: financeiro liberado
        gerente = _cliente("DENTISTA_GERENTE")
        assert gerente.get("/api/faturas/", HTTP_HOST=HOST).status_code == 200

        admin = _cliente("ADMIN")
        assert admin.get("/api/faturas/", HTTP_HOST=HOST).status_code == 200
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_comando_sincronizar_perfis_cria_grupos_e_vincula():
    from django.contrib.auth.models import Group
    from django.core.management import call_command

    clinica = Clinica(schema_name="perfil_cmd", nome_fantasia="Cmd")
    clinica.save()
    Dominio.objects.create(domain="perfilcmd.localhost", tenant=clinica, is_primary=True)
    try:
        with schema_context("perfil_cmd"):
            # Usuário criado ANTES de semear os grupos → ainda sem grupo.
            usuario = Usuario.objects.create_user(email="a@c.com", password=SENHA, papel="RECEPCAO")
            assert usuario.groups.count() == 0

        call_command("sincronizar_perfis")

        with schema_context("perfil_cmd"):
            assert Group.objects.filter(name="RECEPCAO").exists()
            usuario = Usuario.objects.get(email="a@c.com")
            assert list(usuario.groups.values_list("name", flat=True)) == ["RECEPCAO"]
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
