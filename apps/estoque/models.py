"""
Models de gestão de insumos / estoque (schema de cada tenant).

- `CategoriaInsumo`: agrupa insumos (ex.: Descartáveis, Anestésicos).
- `Insumo`: item controlado em estoque, com unidade e nível mínimo.
- `MovimentacaoEstoque`: entradas e saídas que, somadas, formam o saldo do insumo
  (o cálculo do saldo em si vem na próxima tarefa da Sprint 7).
"""

from decimal import Decimal

from django.db import models
from django.db.models import Case, DecimalField, F, Sum, Value, When
from django.db.models.functions import Coalesce

from apps.core.models import ModeloBase


class CategoriaInsumo(ModeloBase):
    """Categoria/agrupamento de insumos (ex.: Descartáveis, Anestésicos)."""

    nome = models.CharField(max_length=100)
    descricao = models.TextField(blank=True)

    class Meta:
        verbose_name = "Categoria de insumo"
        verbose_name_plural = "Categorias de insumo"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Insumo(ModeloBase):
    """Item de estoque da clínica (material de consumo, EPI, etc.)."""

    class Unidade(models.TextChoices):
        UNIDADE = "UN", "Unidade"
        CAIXA = "CX", "Caixa"
        FRASCO = "FR", "Frasco"
        PACOTE = "PC", "Pacote"
        MILILITRO = "ML", "Mililitro"
        GRAMA = "G", "Grama"

    nome = models.CharField(max_length=150)
    categoria = models.ForeignKey(
        CategoriaInsumo,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="insumos",
    )
    unidade = models.CharField(max_length=5, choices=Unidade.choices, default=Unidade.UNIDADE)
    # Nível mínimo para o alerta de reposição (tarefa posterior da Sprint 7).
    estoque_minimo = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    descricao = models.TextField(blank=True)

    class Meta:
        verbose_name = "Insumo"
        verbose_name_plural = "Insumos"
        ordering = ["nome"]

    def __str__(self):
        return f"{self.nome} ({self.get_unidade_display()})"

    def calcular_saldo(self):
        """Saldo atual do insumo: soma das ENTRADAS menos as SAÍDAS (1 query)."""
        return self.movimentacoes.aggregate(
            saldo=Coalesce(
                Sum(
                    Case(
                        When(tipo=MovimentacaoEstoque.Tipo.SAIDA, then=-F("quantidade")),
                        default=F("quantidade"),
                        output_field=DecimalField(max_digits=12, decimal_places=2),
                    )
                ),
                Value(Decimal("0")),
                output_field=DecimalField(max_digits=12, decimal_places=2),
            )
        )["saldo"]

    def estoque_baixo(self):
        """
        Alerta de estoque mínimo: True quando há um mínimo definido (> 0) e o
        saldo atual atingiu ou ficou abaixo dele. Insumo sem mínimo (0) não alerta.
        """
        return self.estoque_minimo > 0 and self.calcular_saldo() <= self.estoque_minimo


class Fornecedor(ModeloBase):
    """Fornecedor/loja de quem a clínica compra insumos (catálogo por tenant)."""

    nome = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "Fornecedor"
        verbose_name_plural = "Fornecedores"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class MovimentacaoEstoque(ModeloBase):
    """Entrada ou saída de um insumo. O tipo define o sentido; a quantidade é o módulo."""

    class Tipo(models.TextChoices):
        ENTRADA = "ENTRADA", "Entrada"
        SAIDA = "SAIDA", "Saída"

    class Subtipo(models.TextChoices):
        AJUSTE = "AJUSTE", "Ajuste"
        COMPRA = "COMPRA", "Compra"

    insumo = models.ForeignKey(Insumo, on_delete=models.PROTECT, related_name="movimentacoes")
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    # Só relevante para ENTRADA: AJUSTE (simples) ou COMPRA (gera conta a pagar).
    subtipo = models.CharField(max_length=10, choices=Subtipo.choices, default=Subtipo.AJUSTE)
    quantidade = models.DecimalField(max_digits=10, decimal_places=2)
    observacao = models.TextField(blank=True)
    # Consulta que originou a movimentação (ex.: baixa automática ao realizar).
    consulta = models.ForeignKey(
        "agenda.Consulta",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movimentacoes_estoque",
    )
    # Consumo específico que gerou esta SAÍDA (permite ajustar/reverter por consumo).
    consumo = models.ForeignKey(
        "ConsumoInsumo",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movimentacoes",
    )
    # Conta a pagar gerada quando subtipo=COMPRA (ver apps.estoque.services.gerar_conta_da_compra).
    lancamento_financeiro = models.ForeignKey(
        "financeiro.LancamentoFinanceiro",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movimentacoes_estoque",
    )

    class Meta:
        verbose_name = "Movimentação de estoque"
        verbose_name_plural = "Movimentações de estoque"
        ordering = ["-criado_em"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantidade__gt=0),
                name="movimentacao_quantidade_positiva",
            )
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} {self.quantidade} - {self.insumo.nome}"


class ConsumoInsumo(ModeloBase):
    """
    Insumo consumido em uma consulta. Ao a consulta ser marcada como REALIZADA,
    cada consumo vira uma SAÍDA de estoque automaticamente (ver signals/services).
    """

    consulta = models.ForeignKey(
        "agenda.Consulta", on_delete=models.CASCADE, related_name="consumos"
    )
    insumo = models.ForeignKey(Insumo, on_delete=models.PROTECT, related_name="consumos")
    quantidade = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        verbose_name = "Consumo de insumo"
        verbose_name_plural = "Consumos de insumo"
        ordering = ["-criado_em"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(quantidade__gt=0),
                name="consumo_quantidade_positiva",
            )
        ]

    def __str__(self):
        return f"{self.quantidade} x {self.insumo.nome} (consulta {self.consulta_id})"
