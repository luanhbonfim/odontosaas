"""
Models da plataforma (schema `public`).

`PlanoAssinatura` representa os planos comerciais do próprio SaaS (o que cada
clínica assina para usar o sistema). Não confundir com `PlanoOdontologico`,
que é o convênio odontológico do paciente (app `pacientes`, sprints adiante).
"""

from django.db import models


class PlanoAssinatura(models.Model):
    """Plano comercial do SaaS assinado por uma clínica."""

    nome = models.CharField(max_length=100, unique=True)
    preco_mensal = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    limite_dentistas = models.PositiveIntegerField(
        null=True, blank=True, help_text="Vazio = ilimitado"
    )
    limite_usuarios = models.PositiveIntegerField(
        null=True, blank=True, help_text="Vazio = ilimitado"
    )
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Plano de assinatura"
        verbose_name_plural = "Planos de assinatura"
        ordering = ["preco_mensal"]

    def __str__(self):
        return self.nome
