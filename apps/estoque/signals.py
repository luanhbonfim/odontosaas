"""Signals do estoque: baixa automática ao realizar a consulta."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.agenda.models import Consulta

from .services import dar_baixa_consulta


@receiver(post_save, sender=Consulta)
def baixa_ao_realizar_consulta(sender, instance, **kwargs):
    """Quando a consulta fica REALIZADA, dá baixa dos insumos consumidos."""
    if instance.status == Consulta.Status.REALIZADA:
        dar_baixa_consulta(instance)
