"""Signals do financeiro: geração automática de contas a receber."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.agenda.models import Consulta
from apps.pacientes.models import Guia

from .services import gerar_conta_da_consulta, gerar_conta_da_guia


@receiver(post_save, sender=Guia)
def conta_ao_executar_guia(sender, instance, **kwargs):
    """Guia EXECUTADA -> conta a receber (convênio) com o valor da guia."""
    if instance.status == Guia.Status.EXECUTADA:
        gerar_conta_da_guia(instance)


@receiver(post_save, sender=Consulta)
def conta_ao_realizar_consulta(sender, instance, **kwargs):
    """Consulta REALIZADA -> conta a receber (particular) com o valor da consulta."""
    if instance.status == Consulta.Status.REALIZADA:
        gerar_conta_da_consulta(instance)
