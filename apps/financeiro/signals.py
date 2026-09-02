"""Signals do financeiro: geração e estorno automático de contas a receber."""

from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from apps.agenda.models import Consulta
from apps.pacientes.models import Guia

from .services import (
    estornar_conta_da_consulta,
    estornar_conta_da_guia,
    gerar_conta_da_consulta,
    gerar_conta_da_guia,
    sincronizar_parcelas_da_consulta,
    sincronizar_valor_conta_da_guia,
)


@receiver(post_save, sender=Guia)
def conta_ao_mudar_guia(sender, instance, **kwargs):
    """Guia EXECUTADA -> gera a conta a receber (e sincroniza o valor se editado);
    GLOSADA -> estorna (se não paga)."""
    if instance.status == Guia.Status.EXECUTADA:
        gerar_conta_da_guia(instance)
        sincronizar_valor_conta_da_guia(instance)  # F3: valor editado após gerar
    elif instance.status == Guia.Status.GLOSADA:
        estornar_conta_da_guia(instance)


@receiver(post_save, sender=Consulta)
def conta_ao_mudar_consulta(sender, instance, **kwargs):
    """Consulta REALIZADA -> gera a conta particular (e sincroniza o valor se editado);
    CANCELADA -> estorna (se não paga)."""
    if instance.status == Consulta.Status.REALIZADA:
        gerar_conta_da_consulta(instance)
        sincronizar_parcelas_da_consulta(instance)  # F3 + parcelamento
    elif instance.status == Consulta.Status.CANCELADA:
        estornar_conta_da_consulta(instance)


@receiver(pre_delete, sender=Guia)
def estornar_ao_excluir_guia(sender, instance, **kwargs):
    """F2: excluir uma guia cancela sua conta a receber PENDENTE (senão fica órfã e
    ainda contada como receita, pois o FK é SET_NULL)."""
    estornar_conta_da_guia(instance)


@receiver(pre_delete, sender=Consulta)
def estornar_ao_excluir_consulta(sender, instance, **kwargs):
    """F2: idem para a conta particular ao excluir a consulta."""
    estornar_conta_da_consulta(instance)
