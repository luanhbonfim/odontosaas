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

    def get_quantidade_lancamentos(self, obj) -> int:
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
    fornecedor_nome = serializers.CharField(source="fornecedor.nome", read_only=True, default=None)
    consulta_procedimento = serializers.SerializerMethodField()
    consulta_data = serializers.SerializerMethodField()
    paciente_nome = serializers.SerializerMethodField()
    origem_automatica = serializers.SerializerMethodField()

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
            "consulta_procedimento",
            "consulta_data",
            "guia",
            "paciente_nome",
            "fornecedor",
            "fornecedor_nome",
            "forma_pagamento",
            "numero_parcela",
            "total_parcelas",
            "origem_automatica",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate_valor(self, valor):
        if valor <= 0:
            raise serializers.ValidationError("O valor deve ser maior que zero.")
        return valor

    def get_consulta_procedimento(self, obj) -> str:
        if not obj.consulta_id:
            return ""
        consulta = obj.consulta
        if consulta.procedimento_catalogo_id:
            return consulta.procedimento_catalogo.nome
        return consulta.procedimento or ""

    def get_consulta_data(self, obj) -> str | None:
        return obj.consulta.inicio.isoformat() if obj.consulta_id else None

    def get_paciente_nome(self, obj) -> str:
        """Nome do paciente do lançamento (particular via consulta, convênio via
        guia) — a tela geral de Contas a Receber/Pagar precisa disso; na aba do
        paciente é implícito, mas aqui não."""
        if obj.consulta_id:
            return obj.consulta.paciente.nome_completo
        if obj.guia_id:
            return obj.guia.plano.paciente.nome_completo
        return ""

    def get_origem_automatica(self, obj) -> bool:
        """True quando o lançamento foi gerado automaticamente (consulta, guia,
        fatura ou compra de insumo) — não editável/excluível pela tela geral.
        Não dá pra derivar isso só de consulta/guia/fatura: uma despesa de
        compra de insumo (`gerar_conta_da_compra`) não tem nenhum dos três,
        só `fornecedor` — mas é gerenciada pelo Estoque, não pelo Financeiro."""
        return bool(
            obj.consulta_id
            or obj.guia_id
            or obj.fatura_id
            or obj.movimentacoes_estoque.exists()
        )
