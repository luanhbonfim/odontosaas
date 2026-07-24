"""Abstrações compartilhadas por todo o projeto."""

from django.db import models


class ModeloBase(models.Model):
    """
    Base abstrata para os models de negócio.

    Fornece carimbos de tempo e um flag `ativo` para soft-delete (quando
    aplicável). Não gera tabela própria — apenas injeta os campos nos models
    concretos que a herdam.
    """

    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)
    ativo = models.BooleanField(default=True)

    class Meta:
        abstract = True
