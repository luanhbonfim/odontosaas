"""
Models de agenda/atendimento (schema de cada tenant).

`Consulta` é o agendamento/atendimento. O `status_confirmacao` é o gatilho das
notificações (WAHA) e da sincronização com o Google Agenda das próximas sprints;
`google_event_id` guardará o ID do evento no Google Calendar.
"""

from django.db import models

from apps.core.models import ModeloBase
from apps.dentistas.models import Dentista
from apps.pacientes.models import Paciente


class Consulta(ModeloBase):
    """Consulta agendada / atendimento."""

    class Status(models.TextChoices):
        AGENDADA = "AGENDADA", "Agendada"
        EM_ATENDIMENTO = "EM_ATENDIMENTO", "Em atendimento"
        REALIZADA = "REALIZADA", "Realizada"
        CANCELADA = "CANCELADA", "Cancelada"
        FALTOU = "FALTOU", "Faltou"

    class StatusConfirmacao(models.TextChoices):
        PENDENTE = "PENDENTE", "Pendente"
        CONFIRMADA = "CONFIRMADA", "Confirmada"
        RECUSADA = "RECUSADA", "Recusada"
        SEM_RESPOSTA = "SEM_RESPOSTA", "Sem resposta"

    paciente = models.ForeignKey(Paciente, on_delete=models.PROTECT, related_name="consultas")
    dentista = models.ForeignKey(Dentista, on_delete=models.PROTECT, related_name="consultas")
    inicio = models.DateTimeField()
    fim = models.DateTimeField()
    procedimento = models.CharField(max_length=255, blank=True)
    # Valor do atendimento particular. Ao ficar REALIZADA (e valor > 0), gera uma
    # conta a receber no financeiro (Sprint 8). Convênio é faturado via Guia.
    valor = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AGENDADA)
    status_confirmacao = models.CharField(
        max_length=20,
        choices=StatusConfirmacao.choices,
        default=StatusConfirmacao.PENDENTE,
    )
    confirmado_em = models.DateTimeField(null=True, blank=True)
    # Preenchido ao sincronizar com o Google Calendar (Sprint 5).
    google_event_id = models.CharField(max_length=255, blank=True)
    observacoes = models.TextField(blank=True)

    class Meta:
        verbose_name = "Consulta"
        verbose_name_plural = "Consultas"
        ordering = ["inicio"]

    def __str__(self):
        return f"{self.paciente.nome_completo} - {self.inicio:%d/%m/%Y %H:%M}"

    # Ciclo de vida do atendimento. REALIZADA/CANCELADA/FALTOU são terminais.
    TRANSICOES = {
        Status.AGENDADA: {Status.EM_ATENDIMENTO, Status.CANCELADA, Status.FALTOU},
        Status.EM_ATENDIMENTO: {Status.REALIZADA, Status.CANCELADA},
        Status.REALIZADA: set(),
        Status.CANCELADA: set(),
        Status.FALTOU: set(),
    }

    def pode_transicionar_para(self, novo_status):
        """Indica se a consulta pode ir do status atual para `novo_status`."""
        return novo_status in self.TRANSICOES.get(self.status, set())


class Anamnese(ModeloBase):
    """Anamnese do paciente — pode ser inicial (sem consulta) ou por consulta."""

    paciente = models.ForeignKey(Paciente, on_delete=models.PROTECT, related_name="anamneses")
    consulta = models.ForeignKey(
        Consulta,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="anamneses",
    )
    queixa_principal = models.TextField(blank=True)
    # Doenças, alergias, medicações em uso, etc.
    historico_medico = models.JSONField(default=dict, blank=True)
    pressao_arterial = models.CharField(max_length=20, blank=True)
    fumante = models.BooleanField(default=False)
    diabetico = models.BooleanField(default=False)
    gestante = models.BooleanField(default=False)
    registrado_por = models.ForeignKey(
        Dentista,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="anamneses_registradas",
    )

    class Meta:
        verbose_name = "Anamnese"
        verbose_name_plural = "Anamneses"
        ordering = ["-criado_em"]

    def __str__(self):
        return f"Anamnese de {self.paciente.nome_completo}"


class AgendaEvento(ModeloBase):
    """Espelho local do evento correspondente no Google Calendar."""

    class StatusSync(models.TextChoices):
        PENDENTE = "PENDENTE", "Pendente"
        SINCRONIZADO = "SINCRONIZADO", "Sincronizado"
        ERRO = "ERRO", "Erro"

    consulta = models.OneToOneField(
        Consulta, on_delete=models.CASCADE, related_name="evento_google"
    )
    google_event_id = models.CharField(max_length=255, blank=True)
    calendar_id = models.CharField(max_length=255, default="primary")
    etag = models.CharField(max_length=255, blank=True)
    sync_token = models.CharField(max_length=255, blank=True)
    ultima_sincronizacao = models.DateTimeField(null=True, blank=True)
    status_sync = models.CharField(
        max_length=20, choices=StatusSync.choices, default=StatusSync.PENDENTE
    )

    class Meta:
        verbose_name = "Evento de agenda (Google)"
        verbose_name_plural = "Eventos de agenda (Google)"

    def __str__(self):
        return f"Evento Google da consulta {self.consulta_id} ({self.get_status_sync_display()})"
