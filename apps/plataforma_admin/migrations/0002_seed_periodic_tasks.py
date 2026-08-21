"""
Migração de dados para semear as tarefas periódicas padrão do Celery Beat no banco de dados.
"""

from django.db import migrations


def semear_tarefas_periodicas(apps, schema_editor):
    """
    Semeia as tarefas periódicas padrão na tabela de PeriodicTask do django_celery_beat.
    Idempotente: usa get_or_create para não sobrescrever customizações feitas em runtime.
    """
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    tarefas = [
        {
            "name": "sincronizar-google-incremental",
            "task": "apps.integracoes.tasks.sincronizar_incremental_todos_tenants",
            "every": 15,
            "period": "minutes",
            "description": "Sincronização incremental de eventos alterados no Google Calendar.",
        },
        {
            "name": "disparar-lembretes-whatsapp",
            "task": "apps.notificacoes.tasks.disparar_lembretes_todos_tenants",
            "every": 1,
            "period": "hours",
            "description": "Varredura periódica para disparo de lembretes e confirmações por WhatsApp.",
        },
        {
            "name": "reconciliar-google",
            "task": "apps.integracoes.tasks.reconciliar_google_todos_tenants",
            "every": 5,
            "period": "minutes",
            "description": "Reconciliação de consultas com o Google Calendar para tenants cujo intervalo venceu.",
        },
        {
            "name": "processar-avisos",
            "task": "apps.notificacoes.tasks.processar_avisos_todos_tenants",
            "every": 1,
            "period": "minutes",
            "description": "Disparo de avisos e reforço de confirmação pré-consulta.",
        },
        {
            "name": "processar-recall",
            "task": "apps.notificacoes.tasks.processar_recall_todos_tenants",
            "every": 6,
            "period": "hours",
            "description": "Varredura periódica de pacientes elegíveis para retorno / recall preventivo.",
        },
    ]

    for item in tarefas:
        intervalo, _ = IntervalSchedule.objects.get_or_create(
            every=item["every"],
            period=item["period"],
        )
        PeriodicTask.objects.get_or_create(
            name=item["name"],
            defaults={
                "task": item["task"],
                "interval": intervalo,
                "enabled": True,
                "description": item["description"],
            },
        )


def reverter_semeadura(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("plataforma_admin", "0001_initial"),
        ("django_celery_beat", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(semear_tarefas_periodicas, reverter_semeadura),
    ]
