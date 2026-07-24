"""
Auditoria de ações sensíveis (LGPD) — schema de cada tenant.

Registra criação/alteração/exclusão de dados pessoais/sensíveis (paciente,
anamnese), com o usuário responsável (capturado pelo middleware).
"""

from django.conf import settings
from django.db import models

from apps.core.models import ModeloBase


class RegistroAuditoria(ModeloBase):
    """Trilha de auditoria de uma ação sobre um dado sensível."""

    class Acao(models.TextChoices):
        CRIACAO = "CRIACAO", "Criação"
        ALTERACAO = "ALTERACAO", "Alteração"
        EXCLUSAO = "EXCLUSAO", "Exclusão"

    acao = models.CharField(max_length=20, choices=Acao.choices)
    modelo = models.CharField(max_length=100)
    objeto_id = models.CharField(max_length=64, blank=True)
    objeto_repr = models.CharField(max_length=255, blank=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="acoes_auditoria",
    )

    class Meta:
        verbose_name = "Registro de auditoria"
        verbose_name_plural = "Registros de auditoria"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.get_acao_display()} {self.modelo} #{self.objeto_id}"
