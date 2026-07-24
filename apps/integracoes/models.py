"""
Models de integrações externas (schema de cada tenant).

`CredencialGoogleCalendar` guarda os tokens OAuth2 do Google — `access_token` e
`refresh_token` ficam **criptografados** em repouso (EncryptedTextField).
`dentista` nulo indica uma credencial da clínica (não de um profissional).
"""

from django.db import models

from apps.core.fields import EncryptedTextField
from apps.core.models import ModeloBase
from apps.dentistas.models import Dentista


class CredencialGoogleCalendar(ModeloBase):
    """Tokens e metadados da conexão OAuth2 com o Google Calendar."""

    dentista = models.ForeignKey(
        Dentista,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="credenciais_google",
        help_text="Nulo = credencial da clínica (não de um dentista específico).",
    )
    calendar_id = models.CharField(max_length=255, default="primary")
    access_token = EncryptedTextField(blank=True)
    refresh_token = EncryptedTextField(blank=True)
    token_expiry = models.DateTimeField(null=True, blank=True)
    scope = models.CharField(max_length=255, blank=True)
    # Token de sincronização incremental do calendário (events.list).
    sync_token = models.TextField(blank=True)
    # Push notifications (watch channels) — renovação na sincronização.
    watch_channel_id = models.CharField(max_length=255, blank=True)
    watch_resource_id = models.CharField(max_length=255, blank=True)
    watch_expiration = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Credencial Google Calendar"
        verbose_name_plural = "Credenciais Google Calendar"

    def __str__(self):
        alvo = self.dentista.nome_completo if self.dentista else "Clínica"
        return f"Google Calendar ({alvo})"
