"""Regras de negócio do estoque (isoladas para facilitar teste e reuso)."""

from apps.agenda.models import Consulta

from .models import ConsumoInsumo, MovimentacaoEstoque


def _saida_do_consumo(consumo):
    """A SAÍDA de estoque vinculada a um consumo específico (ou None)."""
    return MovimentacaoEstoque.objects.filter(
        consumo=consumo, tipo=MovimentacaoEstoque.Tipo.SAIDA
    ).first()


def _criar_saida(consumo):
    """Cria a SAÍDA de estoque correspondente a um consumo."""
    return MovimentacaoEstoque.objects.create(
        insumo=consumo.insumo,
        tipo=MovimentacaoEstoque.Tipo.SAIDA,
        quantidade=consumo.quantidade,
        consulta=consumo.consulta,
        consumo=consumo,
        observacao=f"Baixa automática — consulta #{consumo.consulta_id}",
    )


def dar_baixa_consulta(consulta):
    """
    Gera as SAÍDAS de estoque dos insumos consumidos na consulta.

    Idempotente: se a consulta já teve baixa (existe SAÍDA vinculada a ela), não
    faz nada. Retorna o número de movimentações criadas.
    """
    ja_baixado = MovimentacaoEstoque.objects.filter(
        consulta=consulta, tipo=MovimentacaoEstoque.Tipo.SAIDA
    ).exists()
    if ja_baixado:
        return 0

    criadas = 0
    consumos = ConsumoInsumo.objects.filter(consulta=consulta).select_related("insumo")
    for consumo in consumos:
        _criar_saida(consumo)
        criadas += 1
    return criadas


def reverter_baixa_consulta(consulta):
    """Desfaz a baixa de estoque de uma consulta (ex.: cancelamento), devolvendo os
    insumos ao estoque — remove as SAÍDAs vinculadas. Retorna quantas foram removidas.
    """
    saidas = MovimentacaoEstoque.objects.filter(
        consulta=consulta, tipo=MovimentacaoEstoque.Tipo.SAIDA
    )
    total = saidas.count()
    saidas.delete()
    return total


def sincronizar_saida_do_consumo(consumo):
    """
    Mantém a SAÍDA de um consumo em dia quando a consulta já está REALIZADA:
    cria se faltar (E6: consumo adicionado após a baixa) e ajusta a quantidade se
    o consumo foi editado (E4). Se a consulta não está realizada, não faz nada.
    """
    if consumo.consulta.status != Consulta.Status.REALIZADA:
        return None
    saida = _saida_do_consumo(consumo)
    if saida is None:
        return _criar_saida(consumo)
    if saida.quantidade != consumo.quantidade:
        saida.quantidade = consumo.quantidade
        saida.save(update_fields=["quantidade", "atualizado_em"])
    return saida


def remover_saida_do_consumo(consumo):
    """E5: ao excluir um consumo, remove a SAÍDA correspondente (devolve ao estoque)."""
    return MovimentacaoEstoque.objects.filter(
        consumo=consumo, tipo=MovimentacaoEstoque.Tipo.SAIDA
    ).delete()[0]
