"""Contrato de resposta do Dashboard (também alimenta o schema OpenAPI)."""

from rest_framework import serializers

DINHEIRO = {"max_digits": 14, "decimal_places": 2}


class MetricaInteiraSerializer(serializers.Serializer):
    valor = serializers.IntegerField()
    variacao = serializers.FloatField(allow_null=True)


class MetricaPercentualSerializer(serializers.Serializer):
    """`valor` nulo = sem consultas no período (exibir "—", nunca 0%)."""

    valor = serializers.FloatField(allow_null=True)
    variacao = serializers.FloatField(allow_null=True)


class MetricaDinheiroSerializer(serializers.Serializer):
    valor = serializers.DecimalField(**DINHEIRO)
    variacao = serializers.FloatField(allow_null=True)


class MetricaQuantidadeSerializer(serializers.Serializer):
    valor = serializers.DecimalField(max_digits=14, decimal_places=2)
    variacao = serializers.FloatField(allow_null=True)


class ConsultaPorDiaSerializer(serializers.Serializer):
    data = serializers.DateField()
    dia = serializers.CharField()
    confirmadas = serializers.IntegerField()
    pendentes = serializers.IntegerField()


class ConsultaPorStatusSerializer(serializers.Serializer):
    status = serializers.CharField()
    rotulo = serializers.CharField()
    total = serializers.IntegerField()


class ProximaConsultaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    paciente = serializers.CharField()
    telefone = serializers.CharField(allow_blank=True)
    inicio = serializers.DateTimeField()
    valor = serializers.DecimalField(**DINHEIRO)
    status = serializers.CharField()
    status_confirmacao = serializers.CharField()


class AtendimentoSerializer(serializers.Serializer):
    consultas_hoje = MetricaInteiraSerializer()
    taxa_confirmacao = MetricaPercentualSerializer()
    pacientes_ativos = MetricaInteiraSerializer()
    confirmacoes_pendentes = serializers.IntegerField()
    consultas_por_dia = ConsultaPorDiaSerializer(many=True)
    consultas_por_status = ConsultaPorStatusSerializer(many=True)
    proximas_consultas = ProximaConsultaSerializer(many=True)


class FluxoMensalSerializer(serializers.Serializer):
    mes = serializers.CharField(help_text="AAAA-MM")
    rotulo = serializers.CharField()
    entradas = serializers.DecimalField(**DINHEIRO)
    saidas = serializers.DecimalField(**DINHEIRO)


class DespesaCategoriaSerializer(serializers.Serializer):
    categoria = serializers.CharField()
    rotulo = serializers.CharField()
    valor = serializers.DecimalField(**DINHEIRO)


class FinanceiroSerializer(serializers.Serializer):
    contas_a_receber = MetricaDinheiroSerializer()
    contas_a_pagar = MetricaDinheiroSerializer()
    faturamento_bruto = MetricaDinheiroSerializer()
    faturamento_liquido = MetricaDinheiroSerializer()
    fluxo_caixa = FluxoMensalSerializer(many=True)
    despesas_por_categoria = DespesaCategoriaSerializer(many=True)


class MaterialConsumidoSerializer(serializers.Serializer):
    material = serializers.CharField()
    unidade = serializers.CharField()
    quantidade = serializers.DecimalField(**DINHEIRO)


class EstoqueBaixoItemSerializer(serializers.Serializer):
    item = serializers.CharField()
    unidade = serializers.CharField()
    atual = serializers.DecimalField(**DINHEIRO)
    minimo = serializers.DecimalField(**DINHEIRO)


class EstoqueSerializer(serializers.Serializer):
    itens_em_estoque = MetricaInteiraSerializer()
    insumos_abaixo_minimo = MetricaInteiraSerializer()
    materiais_gastos = MetricaQuantidadeSerializer()
    custo_de_materiais = MetricaDinheiroSerializer()
    materiais_consumidos = MaterialConsumidoSerializer(many=True)
    estoque_baixo = EstoqueBaixoItemSerializer(many=True)


class DashboardSerializer(serializers.Serializer):
    periodo = serializers.CharField()
    atendimento = AtendimentoSerializer()
    financeiro = FinanceiroSerializer(allow_null=True)
    estoque = EstoqueSerializer(allow_null=True)


class DashboardQuerySerializer(serializers.Serializer):
    periodo = serializers.ChoiceField(choices=["mes", "semestre", "ano"], default="semestre")
