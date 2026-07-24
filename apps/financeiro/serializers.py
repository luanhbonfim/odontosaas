"""Serializers do app financeiro."""

from rest_framework import serializers

from .models import Fatura, LancamentoFinanceiro


class FaturaSerializer(serializers.ModelSerializer):
    quantidade_lancamentos = serializers.SerializerMethodField()

    class Meta:
        model = Fatura
        fields = [
            "id",
            "numero",
            "operadora",
            "competencia",
            "valor_total",
            "status",
            "data_emissao",
            "quantidade_lancamentos",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["valor_total", "criado_em", "atualizado_em"]

    def get_quantidade_lancamentos(self, obj):
        return obj.lancamentos.count()


class FluxoCaixaSerializer(serializers.Serializer):
    """Saída do relatório de fluxo de caixa (somente leitura)."""

    a_receber = serializers.DecimalField(max_digits=14, decimal_places=2)
    a_pagar = serializers.DecimalField(max_digits=14, decimal_places=2)
    saldo_previsto = serializers.DecimalField(max_digits=14, decimal_places=2)
    recebido = serializers.DecimalField(max_digits=14, decimal_places=2)
    pago = serializers.DecimalField(max_digits=14, decimal_places=2)
    saldo_realizado = serializers.DecimalField(max_digits=14, decimal_places=2)


class LancamentoFinanceiroSerializer(serializers.ModelSerializer):
    class Meta:
        model = LancamentoFinanceiro
        fields = [
            "id",
            "tipo",
            "descricao",
            "valor",
            "status",
            "vencimento",
            "pago_em",
            "fatura",
            "consulta",
            "guia",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate_valor(self, valor):
        if valor <= 0:
            raise serializers.ValidationError("O valor deve ser maior que zero.")
        return valor
