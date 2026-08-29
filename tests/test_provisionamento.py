"""Testes do comando de provisionamento de tenant (provisionar_clinica)."""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django_tenants.utils import schema_context

from apps.tenants.models import Clinica, Dominio


@pytest.mark.django_db(transaction=True)
def test_provisionar_cria_schema_dominio_e_admin():
    call_command(
        "provisionar_clinica",
        schema="clinicanova",
        nome="Clínica Nova",
        dominio="clinicanova.localhost",
        admin_email="admin@clinicanova.com",
        admin_senha="senha-forte-123",
    )
    try:
        clinica = Clinica.objects.get(schema_name="clinicanova")
        assert Dominio.objects.filter(
            domain="clinicanova.localhost", tenant=clinica, is_primary=True
        ).exists()

        # O schema físico foi criado no Postgres.
        with connection.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM information_schema.schemata WHERE schema_name = %s",
                ["clinicanova"],
            )
            assert cur.fetchone() is not None

        # O admin foi criado dentro do schema do tenant.
        from apps.usuarios.models import Usuario

        with schema_context("clinicanova"):
            admin = Usuario.objects.get(email="admin@clinicanova.com")
            assert admin.papel == "ADMIN"
            assert admin.is_staff is True
    finally:
        clinica.delete(force_drop=True)


@pytest.mark.django_db
def test_provisionar_recusa_schema_duplicado():
    # O tenant público já existe (data migration 0003).
    with pytest.raises(CommandError):
        call_command(
            "provisionar_clinica",
            schema="public",
            nome="Duplicada",
            dominio="nova-unica.localhost",
        )


@pytest.mark.django_db
def test_provisionar_recusa_dominio_duplicado():
    # O domínio 'localhost' já pertence ao tenant público.
    with pytest.raises(CommandError):
        call_command(
            "provisionar_clinica",
            schema="clinica_inedita",
            nome="Inédita",
            dominio="localhost",
        )


@pytest.mark.django_db(transaction=True)
def test_provisionar_recusa_cnpj_duplicado():
    """Erro amigável (nomeando a clínica existente) em vez do IntegrityError cru."""
    call_command(
        "provisionar_clinica",
        schema="clinica_cnpj_a",
        nome="Clínica A",
        dominio="clinica-cnpj-a.localhost",
        cnpj="11222333000181",
    )
    try:
        with pytest.raises(CommandError, match="Clínica A"):
            call_command(
                "provisionar_clinica",
                schema="clinica_cnpj_b",
                nome="Clínica B",
                dominio="clinica-cnpj-b.localhost",
                cnpj="11222333000181",
            )
        assert not Clinica.objects.filter(schema_name="clinica_cnpj_b").exists()
    finally:
        Clinica.objects.get(schema_name="clinica_cnpj_a").delete(force_drop=True)
