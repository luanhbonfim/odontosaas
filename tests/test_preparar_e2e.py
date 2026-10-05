"""`preparar_e2e` deve ser idempotente e tocar SOMENTE no schema `e2e`."""

import pytest
from django.core.management import call_command
from django.db import connection
from django_tenants.utils import schema_context

from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio


@pytest.mark.django_db(transaction=True)
def test_preparar_e2e_idempotente_e_isolado():
    outra = Clinica(schema_name="outra_clinica_e2e", nome_fantasia="Outra")
    outra.save()
    Dominio.objects.create(domain="outra-e2e.localhost", tenant=outra, is_primary=True)
    try:
        with schema_context(outra.schema_name):
            Paciente.objects.create(nome_completo="Intocável", cpf="11122233344")

        call_command("preparar_e2e")
        with schema_context("e2e"):
            Paciente.objects.create(nome_completo="Residual", cpf="11122233355")
        call_command("preparar_e2e")  # 2ª execução: zera o residual, mantém o básico

        with schema_context("e2e"):
            assert list(Paciente.objects.values_list("nome_completo", flat=True)) == [
                "Paciente E2E"
            ]
        with schema_context(outra.schema_name):
            assert Paciente.objects.filter(nome_completo="Intocável").exists()
    finally:
        connection.set_schema_to_public()
        outra.delete(force_drop=True)
        for clinica in Clinica.objects.filter(schema_name="e2e"):
            clinica.delete(force_drop=True)
