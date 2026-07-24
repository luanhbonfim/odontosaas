"""Testes dos comandos de manutenção de tenant: backup (pg_dump) e expurgo."""

from unittest.mock import MagicMock, patch

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection

from apps.tenants.models import Clinica, Dominio

PG = "apps.tenants.management.commands.backup_tenant.subprocess.run"


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_backup_tenant_chama_pgdump():
    clinica = _criar_clinica("bkp_tenant", "bkp.localhost")
    try:
        with patch(PG) as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stderr="")

            # saída explícita
            call_command("backup_tenant", schema="bkp_tenant", saida="/tmp/x.sql")
            cmd = mock_run.call_args[0][0]
            assert cmd[0] == "pg_dump"
            assert "--schema" in cmd and "bkp_tenant" in cmd
            assert "/tmp/x.sql" in cmd

            # sem saída -> nome padrão
            call_command("backup_tenant", schema="bkp_tenant")
            assert "backup_bkp_tenant.sql" in mock_run.call_args[0][0]
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_backup_tenant_inexistente():
    with pytest.raises(CommandError):
        call_command("backup_tenant", schema="nao_existe")


@pytest.mark.django_db(transaction=True)
def test_backup_tenant_falha_pgdump():
    clinica = _criar_clinica("bkp2_tenant", "bkp2.localhost")
    try:
        with patch(PG) as mock_run:
            mock_run.return_value = MagicMock(returncode=1, stderr="erro no dump")
            with pytest.raises(CommandError):
                call_command("backup_tenant", schema="bkp2_tenant")
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_expurgar_tenant():
    clinica = _criar_clinica("exp_tenant", "exp.localhost")
    schema = clinica.schema_name
    removido = False
    try:
        # sem --confirmar -> erro e permanece
        with pytest.raises(CommandError):
            call_command("expurgar_tenant", schema=schema)
        assert Clinica.objects.filter(schema_name=schema).exists()

        # com --confirmar -> remove
        call_command("expurgar_tenant", schema=schema, confirmar=True)
        assert not Clinica.objects.filter(schema_name=schema).exists()
        removido = True
    finally:
        connection.set_schema_to_public()
        if not removido:
            restante = Clinica.objects.filter(schema_name=schema).first()
            if restante:
                restante.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_expurgar_public_e_inexistente():
    with pytest.raises(CommandError):
        call_command("expurgar_tenant", schema="public", confirmar=True)
    with pytest.raises(CommandError):
        call_command("expurgar_tenant", schema="nao_existe", confirmar=True)
