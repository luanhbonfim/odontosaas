"""Testes da base abstrata ModeloBase (app core)."""

from apps.core.models import ModeloBase


def test_modelo_base_e_abstrato():
    """ModeloBase é abstrato (não gera tabela) e expõe os campos esperados."""
    assert ModeloBase._meta.abstract is True
    campos = {f.name for f in ModeloBase._meta.get_fields()}
    assert {"criado_em", "atualizado_em", "ativo"} <= campos


def test_modelo_base_configuracao_dos_campos():
    """Os campos têm o comportamento esperado (timestamps automáticos + ativo)."""
    criado = ModeloBase._meta.get_field("criado_em")
    atualizado = ModeloBase._meta.get_field("atualizado_em")
    ativo = ModeloBase._meta.get_field("ativo")
    assert criado.auto_now_add is True
    assert atualizado.auto_now is True
    assert ativo.default is True
