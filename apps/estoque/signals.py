"""Signals do estoque: baixa ao realizar a consulta, devolução ao cancelar e
ajuste por-consumo (adição/edição/exclusão de ConsumoInsumo)."""

from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from apps.agenda.models import Consulta

from .models import ConsumoInsumo
from .services import (
    dar_baixa_consulta,
    remover_saida_do_consumo,
    reverter_baixa_consulta,
    sincronizar_saida_do_consumo,
)


@receiver(post_save, sender=Consulta)
def estoque_ao_mudar_consulta(sender, instance, **kwargs):
    """REALIZADA -> baixa dos insumos consumidos; CANCELADA -> devolve (reverte)."""
    if instance.status == Consulta.Status.REALIZADA:
        dar_baixa_consulta(instance)
    elif instance.status == Consulta.Status.CANCELADA:
        reverter_baixa_consulta(instance)


@receiver(post_save, sender=ConsumoInsumo)
def saida_ao_mudar_consumo(sender, instance, **kwargs):
    """E4/E6: consumo criado ou editado numa consulta já REALIZADA cria/ajusta a SAÍDA."""
    sincronizar_saida_do_consumo(instance)


@receiver(pre_delete, sender=ConsumoInsumo)
def saida_ao_excluir_consumo(sender, instance, **kwargs):
    """E5: excluir um consumo remove a SAÍDA correspondente (devolve ao estoque).

    `pre_delete` (não post) porque o FK `consumo` é SET_NULL: depois da exclusão a
    SAÍDA já não apontaria para o consumo e não seria encontrada.
    """
    remover_saida_do_consumo(instance)
