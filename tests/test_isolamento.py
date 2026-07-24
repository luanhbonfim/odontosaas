"""
Testes de fundação multi-tenant:
  1. Criação de tenant (schema físico)
  2. Isolamento entre schemas (dados de uma clínica não vazam para outra)
  3. Autenticação por e-mail + papel dentro do tenant
"""

import pytest
from django.contrib.auth import authenticate
from django.db import connection
from django_tenants.utils import schema_context

from apps.tenants.models import Clinica, Dominio
from apps.usuarios.models import Usuario


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()  # cria o schema e roda as migrations do tenant
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_criacao_de_tenant_cria_schema_fisico():
    clinica = _criar_clinica("tenant_criacao", "criacao.localhost")
    try:
        with connection.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM information_schema.schemata WHERE schema_name = %s",
                ["tenant_criacao"],
            )
            assert cur.fetchone() is not None
    finally:
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_isolamento_entre_schemas():
    """Um usuário criado na clínica A não é visível na clínica B."""
    a = _criar_clinica("iso_a", "iso-a.localhost")
    b = _criar_clinica("iso_b", "iso-b.localhost")
    try:
        with schema_context(a.schema_name):
            Usuario.objects.create_user(email="user@a.com", password="senha-123")
            assert Usuario.objects.count() == 1

        with schema_context(b.schema_name):
            assert Usuario.objects.count() == 0
            assert not Usuario.objects.filter(email="user@a.com").exists()

        # E a clínica A continua com o seu usuário.
        with schema_context(a.schema_name):
            assert Usuario.objects.filter(email="user@a.com").exists()
    finally:
        a.delete(force_drop=True)
        b.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_autenticacao_por_email_e_papel():
    clinica = _criar_clinica("auth_tenant", "auth.localhost")
    try:
        with schema_context(clinica.schema_name):
            Usuario.objects.create_user(
                email="dentista@x.com",
                password="senha-forte-123",
                papel=Usuario.Papel.DENTISTA,
            )
            # e-mail + senha corretos autenticam e o papel é preservado
            user = authenticate(username="dentista@x.com", password="senha-forte-123")
            assert user is not None
            assert user.papel == Usuario.Papel.DENTISTA
            # senha errada não autentica
            assert authenticate(username="dentista@x.com", password="errada") is None

            # superusuário criado corretamente
            root = Usuario.objects.create_superuser(email="root@x.com", password="senha-forte-123")
            assert root.is_staff is True
            assert root.is_superuser is True
    finally:
        clinica.delete(force_drop=True)
