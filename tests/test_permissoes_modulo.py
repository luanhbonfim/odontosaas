"""Testes da tela "Permissões" (grade papel×módulo, Gerente/Admin)."""

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio
from apps.usuarios.perfis import sincronizar_grupos

Usuario = get_user_model()


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _cliente(host, email, senha="Senha12345"):
    cache.clear()
    c = APIClient()
    tok = c.post(
        "/api/auth/token/",
        {"email": email, "password": senha},
        format="json",
        HTTP_HOST=host,
    ).json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
    return c


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_gerente_ve_a_grade_com_defaults_da_matriz():
    host = "permgrade.localhost"
    clinica = _criar_clinica("perm_grade_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(
                email="gerente@p.com", password="Senha12345", papel="DENTISTA_GERENTE"
            )

        gerente = _cliente(host, "gerente@p.com")
        resp = gerente.get("/api/permissoes-modulo/", HTTP_HOST=host)
        assert resp.status_code == 200
        grade = {(l["papel"], l["modulo"]): l for l in resp.json()}
        assert len(grade) == 18  # 2 papéis x 9 módulos

        # Recepção hoje tem FULL em estoque (MATRIZ atual) -> default = tudo True.
        recepcao_estoque = grade[("RECEPCAO", "estoque")]
        assert recepcao_estoque == {
            "papel": "RECEPCAO",
            "modulo": "estoque",
            "ver": True,
            "criar": True,
            "editar": True,
            "excluir": True,
        }
        # Dentista hoje não tem financeiro nenhum -> default = tudo False.
        dentista_financeiro = grade[("DENTISTA", "financeiro")]
        assert dentista_financeiro == {
            "papel": "DENTISTA",
            "modulo": "financeiro",
            "ver": False,
            "criar": False,
            "editar": False,
            "excluir": False,
        }
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_recepcao_nao_acessa_permissoes():
    host = "permneg.localhost"
    clinica = _criar_clinica("perm_neg_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(
                email="recep@p.com", password="Senha12345", papel="RECEPCAO"
            )

        recep = _cliente(host, "recep@p.com")
        assert recep.get("/api/permissoes-modulo/", HTTP_HOST=host).status_code == 403
        assert recep.put("/api/permissoes-modulo/", [], format="json", HTTP_HOST=host).status_code == 403
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_gerente_revoga_ver_e_efeito_e_imediato():
    host = "permrevoga.localhost"
    clinica = _criar_clinica("perm_revoga_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(
                email="gerente@p.com", password="Senha12345", papel="DENTISTA_GERENTE"
            )
            Usuario.objects.create_user(
                email="recep@p.com", password="Senha12345", papel="RECEPCAO"
            )

        gerente = _cliente(host, "gerente@p.com")
        recep = _cliente(host, "recep@p.com")

        # Antes: Recepção enxerga Convênios (FULL na MATRIZ hoje).
        assert recep.get("/api/convenios/", HTTP_HOST=host).status_code == 200

        grade = gerente.get("/api/permissoes-modulo/", HTTP_HOST=host).json()
        for linha in grade:
            if linha["papel"] == "RECEPCAO" and linha["modulo"] == "convenios":
                linha.update(ver=False, criar=False, editar=False, excluir=False)
        resp = gerente.put("/api/permissoes-modulo/", grade, format="json", HTTP_HOST=host)
        assert resp.status_code == 200

        # Depois: efeito imediato, sem precisar relogar nem rodar comando.
        assert recep.get("/api/convenios/", HTTP_HOST=host).status_code == 403
        # Outro módulo de Recepção continua intacto.
        assert recep.get("/api/pacientes/", HTTP_HOST=host).status_code == 200
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_put_rejeita_papel_ou_modulo_fora_do_customizavel():
    host = "permrejeita.localhost"
    clinica = _criar_clinica("perm_rejeita_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(
                email="admin@p.com", password="Senha12345", papel="ADMIN"
            )

        admin = _cliente(host, "admin@p.com")

        # Papel fora do customizável (ADMIN).
        resp = admin.put(
            "/api/permissoes-modulo/",
            [{"papel": "ADMIN", "modulo": "estoque", "ver": True, "criar": True, "editar": True, "excluir": True}],
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400

        # Módulo fora do customizável (auditoria).
        resp = admin.put(
            "/api/permissoes-modulo/",
            [{"papel": "RECEPCAO", "modulo": "auditoria", "ver": True, "criar": False, "editar": False, "excluir": False}],
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400

        # criar sem ver -> rejeitado.
        resp = admin.put(
            "/api/permissoes-modulo/",
            [{"papel": "RECEPCAO", "modulo": "estoque", "ver": False, "criar": True, "editar": False, "excluir": False}],
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
