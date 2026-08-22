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
    # Número de WhatsApp da clínica (exibição/contato). Só dígitos com DDI/DDD.
    numero_clinica = models.CharField(max_length=20, blank=True)
    # Gatilho de confirmação: palavras (separadas por vírgula) que CONFIRMAM ou
    # RECUSAM a consulta na resposta do paciente. Vazio = usa o padrão do sistema.
    palavras_confirmacao = models.CharField(max_length=255, blank=True)
    palavras_recusa = models.CharField(max_length=255, blank=True)
    # Enviar a mensagem de agradecimento ao paciente quando ele confirma.
    enviar_agradecimento = models.BooleanField(default=True)
    # Enviar a mensagem de reagendamento quando a consulta é remarcada.
    enviar_reagendamento = models.BooleanField(default=True)
    # Quantos minutos após o reagendamento o aviso é disparado (ex.: 1 = no minuto
    # seguinte). Deixa o horário previsto fixo em vez de "sempre agora".
    reagendamento_minutos = models.PositiveIntegerField(default=1)
    # Enviar a mensagem de cancelamento quando a consulta é cancelada/recusada.
    enviar_cancelamento = models.BooleanField(default=True)
    # Cancelar automaticamente consultas não confirmadas até X horas antes do
    # início (a consulta fica CANCELADA na nossa agenda e sai do Google).
    cancelar_nao_confirmadas = models.BooleanField(default=False)
    cancelar_horas_antes = models.PositiveIntegerField(default=10)
    # Reforço: se o paciente responde algo que não é sim/não, reenviar um pedido
    # para responder apenas SIM ou NÃO (até responder certo).
    reforcar_confirmacao = models.BooleanField(default=True)
    mensagem_reforco = models.CharField(
        max_length=255,
        blank=True,
        help_text="Vazio = texto padrão ('Por favor, responda apenas com SIM ou NÃO.').",
    )
    # Humanização do envio: antes de cada mensagem, mostra "digitando…" ao paciente
    # por `segundos_digitacao` segundos (efeito best-effort). Configurável por clínica
    # (também pelo Vendor Admin). 0 desliga a espera mesmo com simular_digitacao=True.
    simular_digitacao = models.BooleanField(default=True)
    segundos_digitacao = models.PositiveSmallIntegerField(default=4)

    class Meta:
        verbose_name = "Configuração de notificação"
        verbose_name_plural = "Configurações de notificação"

    def __str__(self):
        return f"Config. de notificações (antecedência {self.dias_antecedencia}d)"


class TemplateMensagem(ModeloBase):
    """Modelo de mensagem enviada ao paciente."""

    class Tipo(models.TextChoices):
        CONFIRMACAO = "CONFIRMACAO", "Confirmação"
        AGRADECIMENTO = "AGRADECIMENTO", "Agradecimento"
        LEMBRETE = "LEMBRETE", "Lembrete"
        CANCELAMENTO = "CANCELAMENTO", "Cancelamento"
        REAGENDAMENTO = "REAGENDAMENTO", "Reagendamento"

    class LembreteTipo(models.TextChoices):
        # Recall: chama de volta quem fez um procedimento há mais de X meses.
        RECALL = "RECALL", "Recall por procedimento"
        # Aviso: avisa pacientes CONFIRMADOS X horas antes da consulta.
        PRE_CONSULTA = "PRE_CONSULTA", "Aviso antes da consulta"

    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    corpo = models.TextField(help_text="Variáveis: {{paciente}}, {{data}}, {{hora}}, {{dentista}}")

    # --- Campos usados só quando tipo == LEMBRETE ---
    lembrete_tipo = models.CharField(max_length=20, choices=LembreteTipo.choices, blank=True)
    # RECALL: procedimento-alvo + intervalo (meses) desde a última vez.
    procedimento = models.ForeignKey(
        "procedimentos.Procedimento",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="templates_recall",
    )
    intervalo_meses = models.PositiveSmallIntegerField(null=True, blank=True)
    # PRE_CONSULTA: quantas horas antes do início avisar o paciente confirmado.
    horas_antes = models.PositiveIntegerField(null=True, blank=True)

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
