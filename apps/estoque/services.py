"""Regras de negócio do estoque (isoladas para facilitar teste e reuso)."""

from .models import ConsumoInsumo, MovimentacaoEstoque


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
        MovimentacaoEstoque.objects.create(
            insumo=consumo.insumo,
            tipo=MovimentacaoEstoque.Tipo.SAIDA,
            quantidade=consumo.quantidade,
            consulta=consulta,
            observacao=f"Baixa automática — consulta #{consulta.id}",
        )
        criadas += 1
    return criadas
