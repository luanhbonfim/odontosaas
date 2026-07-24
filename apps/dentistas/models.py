"""
Models de gestão de dentistas (schema de cada tenant).

`Dentista` representa o profissional da clínica (CRO, contato, especialidades)
e pode, opcionalmente, estar vinculado a um `Usuario` (para login no sistema).
"""

from django.conf import settings
from django.db import models

from apps.core.models import ModeloBase


class Especialidade(ModeloBase):
    """Especialidade odontológica (ex.: Ortodontia, Endodontia)."""

    nome = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "Especialidade"
        verbose_name_plural = "Especialidades"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Dentista(ModeloBase):
    """Profissional (dentista) da clínica."""

    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="dentista",
        help_text="Vínculo opcional com a conta de login do profissional.",
    )
    nome_completo = models.CharField(max_length=255)
    cro = models.CharField("CRO", max_length=20, unique=True)
    especialidades = models.ManyToManyField(Especialidade, blank=True, related_name="dentistas")
    telefone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)

    class Meta:
        verbose_name = "Dentista"
        verbose_name_plural = "Dentistas"
        ordering = ["nome_completo"]

    def __str__(self):
        return f"{self.nome_completo} (CRO {self.cro})"
