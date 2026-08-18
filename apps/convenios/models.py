"""Models do app convênios (catálogo por tenant)."""

from django.db import models

from apps.core.models import ModeloBase


class Convenio(ModeloBase):
    """Convênio/operadora que a clínica atende (catálogo).

    Cadastrado uma vez pela clínica e reutilizado nos planos dos pacientes
    (evita digitar a operadora a cada plano). O nome também alimenta o
    faturamento (`PlanoOdontologico.operadora`).
    """

    nome = models.CharField(max_length=100, unique=True)

    class Meta:
        verbose_name = "Convênio"
        verbose_name_plural = "Convênios"
        ordering = ["nome"]

    def __str__(self):
        return self.nome
