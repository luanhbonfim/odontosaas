"""Testes de hardening do Database Studio (Vendor Admin).

Cobre os 2 achados críticos da auditoria de segurança: (1) o schema `public`
guarda dados internos da própria plataforma (2FA de operadores, billing de
todas as clínicas) e não pode ser lido por staff comum; (2) o modo RW roda com
a credencial admin completa do Postgres, então uma referência textual a outro
schema (`outro_schema.tabela`) escaparia do isolamento do `search_path`.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from rest_framework import status
from rest_framework.test import APIClient

from apps.plataforma_admin.studio import _bloquear_referencia_a_outro_schema, executar_sql_studio
from apps.tenants.models import Clinica, Dominio

Usuario = get_user_model()


class _OperadorVendor:
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = True
    email = "vendor_admin@proclinica.cloud"
    pk = 0
    id = 0


class _OperadorStaff:
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = False
    email = "suporte_l2@proclinica.cloud"
    pk = 0
    id = 0


def _garantir_tenant_publico():
    connection.set_schema_to_public()
    publico, _ = Clinica.objects.get_or_create(
        schema_name="public",
        defaults={"nome_fantasia": "Público", "razao_social": "Plataforma OdontoSaaS", "ativo": True},
    )
    Dominio.objects.get_or_create(domain="localhost", tenant=publico, defaults={"is_primary": True})
    return publico


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_staff_nao_superadmin_bloqueado_no_schema_public():
    _garantir_tenant_publico()
    client = APIClient()
    client.force_authenticate(user=_OperadorStaff())
    client.defaults["HTTP_HOST"] = "localhost"

    resp = client.post(
        "/api/plataforma-admin/studio/executar/",
        {"schema": "public", "sql": "SELECT 1", "modo": "RO"},
        format="json",
    )
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db(transaction=True)
def test_superadmin_pode_consultar_public():
    """Não é um bloqueio total do schema — só eleva o privilégio exigido."""
    _garantir_tenant_publico()
    client = APIClient()
    client.force_authenticate(user=_OperadorVendor())
    client.defaults["HTTP_HOST"] = "localhost"

    resp = client.post(
        "/api/plataforma-admin/studio/executar/",
        {"schema": "public", "sql": "SELECT 1", "modo": "RO"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK


@pytest.mark.django_db
def test_bloquear_referencia_a_outro_schema_unitario():
    with pytest.raises(PermissionError):
        _bloquear_referencia_a_outro_schema("SELECT * FROM public.auth_permission", "clinica_x")


@pytest.mark.django_db(transaction=True)
def test_rw_nao_bloqueia_texto_livre_que_menciona_outro_schema():
    """Falso positivo que já existia antes desta correção: um UPDATE legítimo
    gravando texto livre (ex.: uma observação citando outra clínica seguida de
    ponto-final) não pode ser confundido com uma referência de tabela
    qualificada — a checagem roda sobre o SQL com literais neutralizados."""
    clinica_a = _criar_clinica("studio_hard_c", "studiohardc.localhost")
    clinica_b = _criar_clinica("studio_hard_d", "studiohardd.localhost")
    try:
        # A tabela não existe de verdade nesse schema de teste — o que importa
        # aqui é o TIPO do erro: se o guard de cross-schema tivesse disparado
        # (falso positivo), seria PermissionError vindo da nossa validação,
        # antes até de conectar no banco. Qualquer outro erro (ex.: tabela
        # inexistente, vindo do Postgres) prova que passou pela checagem.
        with pytest.raises(Exception) as exc_info:
            executar_sql_studio(
                schema_name="studio_hard_c",
                sql="UPDATE tabela_qualquer SET nota = 'Ligar pra studio_hard_d. Confirmar depois.'",
                modo="RW",
                justificativa="Teste de falso positivo do guard de schema",
            )
        assert not isinstance(exc_info.value, PermissionError)
    finally:
        connection.set_schema_to_public()
        clinica_a.delete(force_drop=True)
        clinica_b.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_rw_bloqueia_referencia_a_outro_schema_conhecido():
    clinica_a = _criar_clinica("studio_hard_a", "studioharda.localhost")
    clinica_b = _criar_clinica("studio_hard_b", "studiohardb.localhost")
    try:
        with pytest.raises(PermissionError, match="studio_hard_b"):
            executar_sql_studio(
                schema_name="studio_hard_a",
                sql="SELECT * FROM studio_hard_b.usuarios_usuario",
                modo="RW",
                justificativa="Teste de isolamento entre schemas do Studio",
            )
    finally:
        connection.set_schema_to_public()
        clinica_a.delete(force_drop=True)
        clinica_b.delete(force_drop=True)
