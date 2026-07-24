"""Serializers do app estoque."""

from rest_framework import serializers

from .models import CategoriaInsumo, ConsumoInsumo, Insumo, MovimentacaoEstoque


class CategoriaInsumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CategoriaInsumo
        fields = ["id", "nome", "descricao", "ativo", "criado_em", "atualizado_em"]
        read_only_fields = ["criado_em", "atualizado_em"]


class InsumoSerializer(serializers.ModelSerializer):
    # Saldo derivado das movimentações (não é campo armazenado). `source` aponta
    # para o método do model; DecimalField garante a saída como string "0.00".
    saldo = serializers.DecimalField(
        max_digits=12, decimal_places=2, read_only=True, source="calcular_saldo"
    )
    # Alerta de estoque mínimo (método `estoque_baixo` do model, resolvido pelo DRF).
    estoque_baixo = serializers.BooleanField(read_only=True)

    class Meta:
        model = Insumo
        fields = [
            "id",
            "nome",
            "descricao",
            "categoria",
            "unidade",
            "estoque_minimo",
            "saldo",
            "estoque_baixo",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]


class MovimentacaoEstoqueSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovimentacaoEstoque
        fields = [
            "id",
            "insumo",
            "tipo",
            "quantidade",
            "observacao",
            "consulta",
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


class ConsumoInsumoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsumoInsumo
        fields = [
            "id",
            "consulta",
            "insumo",
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
