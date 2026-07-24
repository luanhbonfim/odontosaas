"""
Models de notificações WhatsApp (schema de cada tenant).

- ConfiguracaoNotificacao: preferências da clínica (antecedência, sessão WAHA).
- TemplateMensagem: modelo de mensagem com variáveis ({{paciente}}, ...).
- LogNotificacao: histórico de envios/recebimentos e status.
"""

from datetime import time

from django.db import models

from apps.agenda.models import Consulta
from apps.core.models import ModeloBase


class ConfiguracaoNotificacao(ModeloBase):
    """Configuração de notificações da clínica (uma por tenant)."""

    dias_antecedencia = models.PositiveIntegerField(default=1)
    horario_envio = models.TimeField(default=time(9, 0))
    waha_session = models.CharField(max_length=100, blank=True)

    class Meta:
        verbose_name = "Configuração de notificação"
        verbose_name_plural = "Configurações de notificação"

    def __str__(self):
        return f"Config. de notificações (antecedência {self.dias_antecedencia}d)"


class TemplateMensagem(ModeloBase):
    """Modelo de mensagem enviada ao paciente."""

    class Tipo(models.TextChoices):
        CONFIRMACAO = "CONFIRMACAO", "Confirmação"
        LEMBRETE = "LEMBRETE", "Lembrete"
        CANCELAMENTO = "CANCELAMENTO", "Cancelamento"

    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    corpo = models.TextField(help_text="Variáveis: {{paciente}}, {{data}}, {{hora}}, {{dentista}}")

    class Meta:
        verbose_name = "Template de mensagem"
        verbose_name_plural = "Templates de mensagem"

    def __str__(self):
        return self.get_tipo_display()


class LogNotificacao(ModeloBase):
    """Registro de cada notificação enviada/recebida."""

    class Canal(models.TextChoices):
        WHATSAPP = "WHATSAPP", "WhatsApp"

    class Direcao(models.TextChoices):
        ENVIADA = "ENVIADA", "Enviada"
        RECEBIDA = "RECEBIDA", "Recebida"

    class Status(models.TextChoices):
        ENFILEIRADA = "ENFILEIRADA", "Enfileirada"
        ENVIADA = "ENVIADA", "Enviada"
        ENTREGUE = "ENTREGUE", "Entregue"
        LIDA = "LIDA", "Lida"
        RESPONDIDA = "RESPONDIDA", "Respondida"
        ERRO = "ERRO", "Erro"

    consulta = models.ForeignKey(Consulta, on_delete=models.CASCADE, related_name="notificacoes")
    template = models.ForeignKey(
        TemplateMensagem,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="logs",
    )
    canal = models.CharField(max_length=20, choices=Canal.choices, default=Canal.WHATSAPP)
    direcao = models.CharField(max_length=20, choices=Direcao.choices, default=Direcao.ENVIADA)
    mensagem = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ENFILEIRADA)
    # ID da mensagem no provedor (WAHA). Guardado no envio para que a resposta do
    # paciente (replyTo) possa ser casada com a confirmação que enviamos.
    provider_message_id = models.CharField(max_length=255, blank=True)
    resposta_paciente = models.CharField(max_length=255, blank=True)
    enviado_em = models.DateTimeField(null=True, blank=True)
    respondido_em = models.DateTimeField(null=True, blank=True)
    payload_provedor = models.JSONField(default=dict, blank=True)

    class Meta:
        verbose_name = "Log de notificação"
        verbose_name_plural = "Logs de notificação"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"{self.get_direcao_display()} - consulta {self.consulta_id} ({self.status})"
