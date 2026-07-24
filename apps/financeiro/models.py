"""
Models de gestão financeira (schema de cada tenant).

- `Fatura`: agrupamento de cobrança (ex.: faturamento por operadora).
- `LancamentoFinanceiro`: conta a receber (RECEITA) ou a pagar (DESPESA).

A geração automática de contas a receber, os lançamentos manuais, o faturamento
por operadora e o fluxo de caixa vêm nas próximas tarefas da Sprint 8.
"""

from django.db import models

from apps.core.models import ModeloBase


class Fatura(ModeloBase):
    """Fatura de cobrança (agrupa lançamentos, ex.: por operadora/competência)."""

    class Status(models.TextChoices):
        ABERTA = "ABERTA", "Aberta"
        ENVIADA = "ENVIADA", "Enviada"
        PAGA = "PAGA", "Paga"
        GLOSADA = "GLOSADA", "Glosada"

    numero = models.CharField(max_length=50, blank=True)
    operadora = models.CharField(max_length=100)
    competencia = models.CharField(max_length=7, blank=True, help_text="Referência MM/AAAA")
    valor_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ABERTA)
    data_emissao = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = "Fatura"
        verbose_name_plural = "Faturas"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"Fatura {self.numero or self.pk} - {self.operadora} ({self.get_status_display()})"


class LancamentoFinanceiro(ModeloBase):
    """Conta a receber (RECEITA) ou a pagar (DESPESA) da clínica."""

    class Tipo(models.TextChoices):
        RECEITA = "RECEITA", "Receita (a receber)"
        DESPESA = "DESPESA", "Despesa (a pagar)"

    class Status(models.TextChoices):
        PENDENTE = "PENDENTE", "Pendente"
        PAGO = "PAGO", "Pago/Recebido"
        CANCELADO = "CANCELADO", "Cancelado"

    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    descricao = models.CharField(max_length=255)
    valor = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDENTE)
    vencimento = models.DateField(null=True, blank=True)
    pago_em = models.DateTimeField(null=True, blank=True)
    fatura = models.ForeignKey(
        Fatura,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lancamentos",
    )
    # Origem da conta (para rastreio e idempotência da geração automática).
    consulta = models.ForeignKey(
        "agenda.Consulta",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lancamentos",
    )
    guia = models.ForeignKey(
        "pacientes.Guia",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="lancamentos",
    )

    class Meta:
        verbose_name = "Lançamento financeiro"
        verbose_name_plural = "Lançamentos financeiros"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.get_tipo_display()} - {self.descricao}: {self.valor}"
