"""Models do app procedimentos (catálogo por tenant)."""

from django.db import models

from apps.core.models import ModeloBase


class Procedimento(ModeloBase):
    """Procedimento clínico que a clínica realiza (catálogo).

    Cadastrado uma vez pela clínica e reutilizado no agendamento das consultas
    (padroniza o que é feito, ex.: "Limpeza", "Canal"). Também é a base das
    regras de lembrete/recall (ex.: chamar de volta quem fez limpeza há 6 meses).
    """

    nome = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "Procedimento"
        verbose_name_plural = "Procedimentos"
        ordering = ["nome"]

    def __str__(self):
        return self.nome
