"""Testes do app estoque (models CategoriaInsumo, Insumo, MovimentacaoEstoque)."""

from decimal import Decimal

import pytest
from django.db import connection
from django_tenants.utils import schema_context

from apps.estoque.models import CategoriaInsumo, Insumo, MovimentacaoEstoque
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_estoque_no_tenant_apps(settings):
    assert "apps.estoque" in settings.TENANT_APPS


@pytest.mark.django_db(transaction=True)
def test_criar_insumo_categoria_e_movimentacoes():
    clinica = _criar_clinica("estoque_tenant", "estoque.localhost")
    try:
        with schema_context(clinica.schema_name):
            categoria = CategoriaInsumo.objects.create(nome="Descartáveis")
            insumo = Insumo.objects.create(
                nome="Luva de procedimento",
                categoria=categoria,
                unidade=Insumo.Unidade.CAIXA,
                estoque_minimo=Decimal("5"),
            )
            entrada = MovimentacaoEstoque.objects.create(
                insumo=insumo, tipo=MovimentacaoEstoque.Tipo.ENTRADA, quantidade=Decimal("10")
            )
            saida = MovimentacaoEstoque.objects.create(
                insumo=insumo, tipo=MovimentacaoEstoque.Tipo.SAIDA, quantidade=Decimal("3")
            )

            # Relacionamentos
            assert insumo.categoria == categoria
            assert list(categoria.insumos.all()) == [insumo]
            assert insumo.movimentacoes.count() == 2

            # __str__
            assert str(categoria) == "Descartáveis"
            assert str(insumo) == "Luva de procedimento (Caixa)"
            assert str(entrada).startswith("Entrada") and "Luva de procedimento" in str(entrada)
            assert str(saida).startswith("Saída")
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_insumo_sem_categoria_usa_padroes():
    clinica = _criar_clinica("estoque_sc_tenant", "estoquesc.localhost")
    try:
        with schema_context(clinica.schema_name):
            insumo = Insumo.objects.create(nome="Gaze")  # categoria opcional
            assert insumo.categoria is None
            assert insumo.unidade == Insumo.Unidade.UNIDADE  # padrão
            assert insumo.estoque_minimo == 0  # padrão
            assert str(insumo) == "Gaze (Unidade)"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_estoque_baixo_metodo():
    clinica = _criar_clinica("estoque_alerta_tenant", "estoquealerta.localhost")
    try:
        with schema_context(clinica.schema_name):
            # Sem mínimo definido (0) -> nunca alerta, mesmo com saldo 0.
            sem_min = Insumo.objects.create(nome="Sem minimo")
            assert sem_min.estoque_baixo() is False

            insumo = Insumo.objects.create(nome="Anestésico", estoque_minimo=Decimal("5"))
            # saldo 2 (< 5) -> alerta
            MovimentacaoEstoque.objects.create(
                insumo=insumo, tipo="ENTRADA", quantidade=Decimal("2")
            )
            assert insumo.estoque_baixo() is True
            # saldo 5 (= mínimo) -> ainda alerta
            MovimentacaoEstoque.objects.create(
                insumo=insumo, tipo="ENTRADA", quantidade=Decimal("3")
            )
            assert insumo.estoque_baixo() is True
            # saldo 8 (> 5) -> ok
            MovimentacaoEstoque.objects.create(
                insumo=insumo, tipo="ENTRADA", quantidade=Decimal("3")
            )
            assert insumo.estoque_baixo() is False
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_categoria_apagada_mantem_insumo():
    """SET_NULL: apagar a categoria não apaga o insumo (fica sem categoria)."""
    clinica = _criar_clinica("estoque_del_tenant", "estoquedel.localhost")
    try:
        with schema_context(clinica.schema_name):
            categoria = CategoriaInsumo.objects.create(nome="Temporária")
            insumo = Insumo.objects.create(nome="Agulha", categoria=categoria)
            categoria.delete()
            insumo.refresh_from_db()
            assert insumo.categoria is None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
