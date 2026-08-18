"""
Signals da agenda ligados ao Google Calendar.

A sincronização com o Google NÃO é imediata (para não sobrecarregar): tudo é
reconciliado pela sync periódica (`reconciliar_google`). Aqui só registramos um
tombstone quando a consulta é EXCLUÍDA — aí a linha (e o AgendaEvento) somem, e
a reconciliação precisa do ID para apagar o evento no Google depois.
"""

from django.db.models.signals import pre_delete, pre_save
from django.dispatch import receiver
from django.utils import timezone

from .models import AgendaEvento, Consulta, EventoGoogleRemovido


@receiver(pre_save, sender=Consulta)
def marcar_reagendamento(sender, instance, **kwargs):
    """Consulta CONFIRMADA cujo `inicio` mudou -> marca `reagendada_em`. Isso
    rearma a fila: aviso de reagendamento (após o atraso configurado) + recálculo
    do lembrete pré-consulta para o novo horário.

    Só vale para consultas AGENDADA e CONFIRMADA — reagendamento não é enviado a
    quem ainda não confirmou (nesse caso o pedido de confirmação segue seu curso).
    """
    if not instance.pk:
        return  # criação, não é reagendamento
    if instance.status != Consulta.Status.AGENDADA:
        return  # só consultas ativas
    if instance.status_confirmacao != Consulta.StatusConfirmacao.CONFIRMADA:
        return  # reagendamento só para quem já confirmou
    anterior = Consulta.objects.filter(pk=instance.pk).values_list("inicio", flat=True).first()
    if anterior is not None and anterior != instance.inicio:
        instance.reagendada_em = timezone.now()


@receiver(pre_delete, sender=Consulta)
def enfileirar_remocao_no_google(sender, instance, **kwargs):
    """Consulta EXCLUÍDA -> enfileira a remoção dos seus eventos do Google.

    Não remove na hora: a próxima reconciliação apaga por ID (evita chamadas
    imediatas à API e mantém tudo pelo fluxo de sincronização).

    Só enfileira eventos SISTEMA (criados por nós). Evento IMPORTADO (a clínica
    criou à mão no Google) NUNCA é removido — mesmo excluindo a consulta aqui.
    """
    for evento in AgendaEvento.objects.filter(
        consulta=instance, origem=AgendaEvento.Origem.SISTEMA
    ):
        if evento.google_event_id:
            EventoGoogleRemovido.objects.create(
                credencial=evento.credencial,
                calendar_id=evento.calendar_id,
                google_event_id=evento.google_event_id,
            )
