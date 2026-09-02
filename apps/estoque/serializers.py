"""Serializers do app estoque."""

from rest_framework import serializers

from apps.financeiro.models import LancamentoFinanceiro

from .models import CategoriaInsumo, ConsumoInsumo, Fornecedor, Insumo, MovimentacaoEstoque
from .services import gerar_conta_da_compra


class CategoriaInsumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaInsumo
        fields = ["id", "nome", "descricao", "ativo", "criado_em", "atualizado_em"]
        read_only_fields = ["criado_em", "atualizado_em"]


class FornecedorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fornecedor
        fields = ["id", "nome", "ativo", "criado_em", "atualizado_em"]
        read_only_fields = ["criado_em", "atualizado_em"]


class InsumoSerializer(serializers.ModelSerializer):
    # Saldo derivado das movimentações (não é campo armazenado). `source` aponta
    # para o método do model; DecimalField garante a saída como string "0.00".
    saldo = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True, source="calcular_saldo"
    )
    # Alerta de estoque mínimo (método `estoque_baixo` do model, resolvido pelo DRF).
    estoque_baixo = serializers.BooleanField(read_only=True)
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True, default=None)

    class Meta:
        model = Insumo
        fields = [
            "id",
            "nome",
            "descricao",
            "categoria",
            "categoria_nome",
            "unidade",
            "estoque_minimo",
            "saldo",
            "estoque_baixo",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]


class LancamentoDaMovimentacaoSerializer(serializers.ModelSerializer):
    """Resumo somente leitura da conta a pagar gerada por uma compra."""

    fornecedor_nome = serializers.CharField(source="fornecedor.nome", read_only=True, default=None)

    class Meta:
        model = LancamentoFinanceiro
        fields = ["id", "valor", "vencimento", "forma_pagamento", "fornecedor", "fornecedor_nome", "status"]


class MovimentacaoEstoqueSerializer(serializers.ModelSerializer):
    insumo_nome = serializers.CharField(source="insumo.nome", read_only=True)
    lancamento_financeiro_detalhe = LancamentoDaMovimentacaoSerializer(
        source="lancamento_financeiro", read_only=True, allow_null=True
    )
    # Campos de uma Compra: não persistidos na movimentação, usados só para gerar
    # a conta a pagar (ver `create()`/`apps.estoque.services.gerar_conta_da_compra`).
    fornecedor = serializers.PrimaryKeyRelatedField(
        queryset=Fornecedor.objects.all(), write_only=True, required=False, allow_null=True
    )
    valor = serializers.DecimalField(
        max_digits=12, decimal_places=2, write_only=True, required=False, allow_null=True
    )
    forma_pagamento = serializers.ChoiceField(
        choices=LancamentoFinanceiro.FormaPagamento.choices,
        write_only=True,
        required=False,
        allow_blank=True,
    )
    data_vencimento = serializers.DateField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = MovimentacaoEstoque
        fields = [
            "id",
            "insumo",
            "insumo_nome",
            "tipo",
            "subtipo",
            "quantidade",
            "observacao",
            "consulta",
            "lancamento_financeiro_detalhe",
            "fornecedor",
            "valor",
            "forma_pagamento",
            "data_vencimento",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate_quantidade(self, valor):
        """A quantidade movimentada é sempre positiva; o `tipo` define o sentido."""
        if valor <= 0:
            raise serializers.ValidationError("A quantidade deve ser maior que zero.")
        return valor

    def validate(self, dados):
        tipo = dados.get("tipo")
        subtipo = dados.get("subtipo") or MovimentacaoEstoque.Subtipo.AJUSTE
        if tipo == MovimentacaoEstoque.Tipo.SAIDA:
            dados["subtipo"] = MovimentacaoEstoque.Subtipo.AJUSTE
        elif subtipo == MovimentacaoEstoque.Subtipo.COMPRA:
            if not dados.get("fornecedor"):
                raise serializers.ValidationError({"fornecedor": "Obrigatório para uma compra."})
            if not dados.get("valor") or dados["valor"] <= 0:
                raise serializers.ValidationError({"valor": "Obrigatório (maior que zero) para uma compra."})
        return dados

    def create(self, validated_data):
        fornecedor = validated_data.pop("fornecedor", None)
        valor = validated_data.pop("valor", None)
        forma_pagamento = validated_data.pop("forma_pagamento", "")
        data_vencimento = validated_data.pop("data_vencimento", None)

        movimentacao = super().create(validated_data)

        if movimentacao.subtipo == MovimentacaoEstoque.Subtipo.COMPRA:
            gerar_conta_da_compra(
                movimentacao,
                fornecedor=fornecedor,
                valor=valor,
                forma_pagamento=forma_pagamento,
                data_vencimento=data_vencimento,
            )
        return movimentacao


class ConsumoInsumoSerializer(serializers.ModelSerializer):
    insumo_nome = serializers.CharField(source="insumo.nome", read_only=True)

    class Meta:
        model = ConsumoInsumo
        fields = [
            "id",
            "consulta",
            "insumo",
            "insumo_nome",
            "quantidade",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate_quantidade(self, valor):
        if valor <= 0:
            raise serializers.ValidationError("A quantidade deve ser maior que zero.")
        return valor
