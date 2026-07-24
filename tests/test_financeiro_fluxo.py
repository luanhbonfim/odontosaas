"""Testes do relatório de fluxo de caixa (a receber × a pagar)."""

from decimal import Decimal

import pytest
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.financeiro.models import LancamentoFinanceiro
from apps.financeiro.services import calcular_fluxo_caixa
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _lanc(tipo, valor, status=LancamentoFinanceiro.Status.PENDENTE):
    return LancamentoFinanceiro.objects.create(
        tipo=tipo, descricao="x", valor=Decimal(valor), status=status
    )


@pytest.mark.django_db(transaction=True)
def test_calcular_fluxo_caixa():
    clinica = _criar_clinica("flx_tenant", "flx.localhost")
    try:
        with schema_context(clinica.schema_name):
            R, D = LancamentoFinanceiro.Tipo.RECEITA, LancamentoFinanceiro.Tipo.DESPESA
            PAGO = LancamentoFinanceiro.Status.PAGO
            _lanc(R, "150")
            _lanc(R, "150")  # a receber = 300
            _lanc(D, "200")  # a pagar = 200
            _lanc(R, "100", PAGO)  # recebido = 100
            _lanc(D, "50", PAGO)  # pago = 50

            f = calcular_fluxo_caixa()
            assert f["a_receber"] == Decimal("300")
            assert f["a_pagar"] == Decimal("200")
            assert f["saldo_previsto"] == Decimal("100")  # 300 - 200
            assert f["recebido"] == Decimal("100")
            assert f["pago"] == Decimal("50")
            assert f["saldo_realizado"] == Decimal("50")  # 100 - 50

            # Filtro por período (vencimento) sem lançamentos no range -> zeros
            vazio = calcular_fluxo_caixa(de="2030-01-01", ate="2030-12-31")
            assert vazio["a_receber"] == Decimal("0")
            assert vazio["saldo_previsto"] == Decimal("0")
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_endpoint_fluxo_caixa():
    host = "apiflx.localhost"
    clinica = _criar_clinica("api_flx", host)
    client = APIClient()
    try:
        client.post(
            "/api/lancamentos/",
            {"tipo": "RECEITA", "descricao": "r", "valor": "200"},
            format="json",
            HTTP_HOST=host,
        )
        client.post(
            "/api/lancamentos/",
            {"tipo": "DESPESA", "descricao": "d", "valor": "80"},
            format="json",
            HTTP_HOST=host,
        )

        resp = client.get("/api/lancamentos/fluxo-caixa/", HTTP_HOST=host)
        assert resp.status_code == 200
        dados = resp.json()
        assert dados["a_receber"] == "200.00"
        assert dados["a_pagar"] == "80.00"
        assert dados["saldo_previsto"] == "120.00"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
