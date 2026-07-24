"""Testes do faturamento por operadora (agrupa contas a receber de guias em Fatura)."""

from decimal import Decimal

import pytest
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.financeiro.models import LancamentoFinanceiro
from apps.financeiro.services import faturar_operadora
from apps.pacientes.models import Guia, Paciente, PlanoOdontologico
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _guia_executada(operadora, valor, seq):
    """Cria guia executada -> o signal gera a conta a receber correspondente."""
    paciente = Paciente.objects.create(nome_completo="P", cpf=f"222333{seq:05d}")
    plano = PlanoOdontologico.objects.create(paciente=paciente, operadora=operadora)
    guia = Guia.objects.create(
        plano=plano,
        numero_guia=f"G{seq}",
        procedimento="Proc",
        valor=Decimal(valor),
        status=Guia.Status.AUTORIZADA,
    )
    guia.status = Guia.Status.EXECUTADA
    guia.save(update_fields=["status", "atualizado_em"])
    return guia


@pytest.mark.django_db(transaction=True)
def test_faturar_operadora_agrupa_contas():
    clinica = _criar_clinica("fat_tenant", "fat.localhost")
    try:
        with schema_context(clinica.schema_name):
            _guia_executada("Amil", "100", 1)
            _guia_executada("Amil", "150", 2)
            _guia_executada("Uniodonto", "80", 3)

            fatura = faturar_operadora("Amil", "07/2026")
            assert fatura.operadora == "Amil"
            assert fatura.competencia == "07/2026"
            assert fatura.valor_total == Decimal("250.00")  # 100 + 150
            assert fatura.lancamentos.count() == 2

            # A conta da Uniodonto continua sem fatura
            assert (
                LancamentoFinanceiro.objects.filter(
                    tipo=LancamentoFinanceiro.Tipo.RECEITA, fatura__isnull=True
                ).count()
                == 1
            )

            # Re-faturar a mesma operadora -> nada pendente
            assert faturar_operadora("Amil") is None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_endpoint_faturar():
    host = "apifat.localhost"
    clinica = _criar_clinica("api_fat", host)
    client = APIClient()
    try:
        with schema_context("api_fat"):
            _guia_executada("Amil", "100", 1)
            _guia_executada("Amil", "150", 2)

        # faturar via endpoint
        resp = client.post(
            "/api/faturas/faturar/",
            {"operadora": "Amil", "competencia": "07/2026"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        assert resp.json()["valor_total"] == "250.00"
        assert resp.json()["quantidade_lancamentos"] == 2

        # sem operadora -> 400
        assert (
            client.post("/api/faturas/faturar/", {}, format="json", HTTP_HOST=host).status_code
            == 400
        )
        # operadora sem contas pendentes -> 400
        resp = client.post(
            "/api/faturas/faturar/", {"operadora": "Inexistente"}, format="json", HTTP_HOST=host
        )
        assert resp.status_code == 400

        # a fatura aparece na listagem
        assert len(client.get("/api/faturas/", HTTP_HOST=host).json()) == 1
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
