"""
Models da plataforma (schema `public`).

`PlanoAssinatura` representa os planos comerciais do próprio SaaS (o que cada
clínica assina para usar o sistema). Não confundir com `PlanoOdontologico`,
que é o convênio odontológico do paciente (app `pacientes`, sprints adiante).
"""

from django.db import models


class PlanoAssinatura(models.Model):
    """Plano comercial do SaaS assinado por uma clínica."""

    class Periodicidade(models.TextChoices):
        MENSAL = "MENSAL", "Mensal"
        ANUAL = "ANUAL", "Anual"
        PERMANENTE = "PERMANENTE", "Permanente (Vitalício)"

    nome = models.CharField(max_length=100, unique=True)
    periodicidade = models.CharField(
        max_length=20,
        choices=Periodicidade.choices,
        default=Periodicidade.MENSAL,
        help_text="Ciclo de cobrança/renovação padrão do plano",
    )
    preco_mensal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    preco_anual = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Valor anual com desconto (opcional)",
    )
    limite_dentistas = models.PositiveIntegerField(
        null=True, blank=True, help_text="Vazio = ilimitado"
    )
    limite_usuarios = models.PositiveIntegerField(
        null=True, blank=True, help_text="Vazio = ilimitado"
    )
    limite_pacientes_ativos = models.PositiveIntegerField(
        null=True, blank=True, help_text="Vazio = ilimitado"
    )
    limite_armazenamento_mb = models.PositiveIntegerField(
        default=1024,
        help_text="Cota em MB para uploads futuros",
    )
    modulo_financeiro_ativo = models.BooleanField(
        default=True,
        help_text="Habilita módulo financeiro",
    )
    modulo_estoque_ativo = models.BooleanField(
        default=True,
        help_text="Habilita módulo de estoque/insumos",
    )
    sync_google_ativo = models.BooleanField(
        default=True,
        help_text="Habilita integração com Google Calendar",
    )
    whatsapp_waha_ativo = models.BooleanField(
        default=True,
        help_text="Habilita automações de WhatsApp",
    )
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Plano de assinatura"
        verbose_name_plural = "Planos de assinatura"
        ordering = ["preco_mensal"]

    def __str__(self):
        return self.nome
