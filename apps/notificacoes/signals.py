"""Signals de notificações: avisa o paciente quando a consulta é CANCELADA.

Cobre os dois caminhos de cancelamento (recusa do paciente via WhatsApp e
cancelamento manual da clínica), pois ambos gravam `status=CANCELADA`.
"""

from django.db import connection
from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from apps.agenda.models import Consulta


@receiver(pre_save, sender=Consulta)
def _marcar_transicao_cancelada(sender, instance, **kwargs):
    """Marca no objeto se esta gravação está levando a consulta para CANCELADA."""
    if not instance.pk:
        instance._virou_cancelada = False
        return
    anterior = Consulta.objects.filter(pk=instance.pk).only("status").first()
    instance._virou_cancelada = bool(
        anterior
        and anterior.status != Consulta.Status.CANCELADA
        and instance.status == Consulta.Status.CANCELADA
    )


@receiver(post_save, sender=Consulta)
def _avisar_cancelamento(sender, instance, created, **kwargs):
    """Ao cancelar, dispara a mensagem de cancelamento (template) ao paciente."""
    if created or not getattr(instance, "_virou_cancelada", False):
        return
    from apps.notificacoes.tasks import enviar_cancelamento_task

    enviar_cancelamento_task.delay(connection.schema_name, instance.id)
