"""Testes do app financeiro (models Fatura e LancamentoFinanceiro)."""

from decimal import Decimal

import pytest
from django.db import connection
from django_tenants.utils import schema_context

from apps.financeiro.models import Fatura, LancamentoFinanceiro
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_financeiro_no_tenant_apps(settings):
    assert "apps.financeiro" in settings.TENANT_APPS


@pytest.mark.django_db(transaction=True)
def test_criar_lancamentos_e_fatura():
    clinica = _criar_clinica("fin_tenant", "fin.localhost")
    try:
        with schema_context(clinica.schema_name):
            fatura = Fatura.objects.create(
                numero="F-001", operadora="Amil Dental", competencia="07/2026"
            )
            receber = LancamentoFinanceiro.objects.create(
                tipo=LancamentoFinanceiro.Tipo.RECEITA,
                descricao="Consulta particular",
                valor=Decimal("150.00"),
                fatura=fatura,
            )
            pagar = LancamentoFinanceiro.objects.create(
                tipo=LancamentoFinanceiro.Tipo.DESPESA,
                descricao="Compra de luvas",
                valor=Decimal("80.00"),
            )

            # Padrões
            assert receber.status == LancamentoFinanceiro.Status.PENDENTE
            assert fatura.status == Fatura.Status.ABERTA
            assert pagar.fatura is None

            # Relacionamento fatura <-> lançamentos
            assert list(fatura.lancamentos.all()) == [receber]

            # __str__
            assert str(fatura) == "Fatura F-001 - Amil Dental (Aberta)"
            assert str(receber).startswith("Receita (a receber) - Consulta particular")
            assert "80.00" in str(pagar)
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_fatura_apagada_solta_lancamento():
    """SET_NULL: apagar a fatura não apaga o lançamento (fica sem fatura)."""
    clinica = _criar_clinica("fin_del_tenant", "findel.localhost")
    try:
        with schema_context(clinica.schema_name):
            fatura = Fatura.objects.create(operadora="Uniodonto")
            lanc = LancamentoFinanceiro.objects.create(
                tipo=LancamentoFinanceiro.Tipo.RECEITA,
                descricao="Guia executada",
                valor=Decimal("200.00"),
                fatura=fatura,
            )
            # Fatura sem número usa o pk no __str__
            assert str(fatura).startswith(f"Fatura {fatura.pk} - Uniodonto")
            fatura.delete()
            lanc.refresh_from_db()
            assert lanc.fatura is None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
