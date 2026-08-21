"""
Gerenciador de tarefas periódicas e monitoramento de workers/filas do Celery.
"""

import logging
from typing import Any

import redis
from celery import current_app
from django.conf import settings
from django_celery_beat.models import (
    IntervalSchedule,
    PeriodicTask,
)

from apps.plataforma_admin.models import RegistroAuditoriaVendor
from apps.plataforma_admin.services import registrar_auditoria_vendor

logger = logging.getLogger(__name__)

# Dicionário de descrições detalhadas das tarefas periódicas
DESCRICOES_PADRAO = {
    "sincronizar-google-incremental": "Sincronização incremental de eventos alterados no Google Calendar para todas as clínicas.",
    "disparar-lembretes-whatsapp": "Varredura periódica para disparo de lembretes e confirmações automáticas por WhatsApp.",
    "reconciliar-google": "Reconciliação e sincronização bidirecional de consultas com o Google Calendar.",
    "processar-avisos": "Disparo de avisos, reforços de confirmação e alertas pré-consulta via WhatsApp.",
    "processar-recall": "Varredura periódica de pacientes elegíveis para retorno / recall preventivo.",
    "celery.backend_cleanup": "Limpeza e expurgo automático de resultados expirados do Celery no banco de dados e Redis.",
}

# Catálogo padrão das tarefas periódicas da plataforma
TAREFAS_PADRAO = [
    {
        "name": "sincronizar-google-incremental",
        "task": "apps.integracoes.tasks.sincronizar_incremental_todos_tenants",
        "every": 15,
        "period": IntervalSchedule.MINUTES,
        "description": DESCRICOES_PADRAO["sincronizar-google-incremental"],
    },
    {
        "name": "disparar-lembretes-whatsapp",
        "task": "apps.notificacoes.tasks.disparar_lembretes_todos_tenants",
        "every": 1,
        "period": IntervalSchedule.HOURS,
        "description": DESCRICOES_PADRAO["disparar-lembretes-whatsapp"],
    },
    {
        "name": "reconciliar-google",
        "task": "apps.integracoes.tasks.reconciliar_google_todos_tenants",
        "every": 5,
        "period": IntervalSchedule.MINUTES,
        "description": DESCRICOES_PADRAO["reconciliar-google"],
    },
    {
        "name": "processar-avisos",
        "task": "apps.notificacoes.tasks.processar_avisos_todos_tenants",
        "every": 1,
        "period": IntervalSchedule.MINUTES,
        "description": DESCRICOES_PADRAO["processar-avisos"],
    },
    {
        "name": "processar-recall",
        "task": "apps.notificacoes.tasks.processar_recall_todos_tenants",
        "every": 6,
        "period": IntervalSchedule.HOURS,
        "description": DESCRICOES_PADRAO["processar-recall"],
    },
]


def garantir_tarefas_padrao_no_banco() -> None:
    """
    Sincroniza e garante que todas as tarefas periódicas padrão existam
    como registros de `django_celery_beat.PeriodicTask` no banco de dados,
    atualizando suas descrições informativas.
    """
    for item in TAREFAS_PADRAO:
        intervalo, _ = IntervalSchedule.objects.get_or_create(
            every=item["every"],
            period=item["period"],
        )
        task_obj, created = PeriodicTask.objects.get_or_create(
            name=item["name"],
            defaults={
                "task": item["task"],
                "interval": intervalo,
                "enabled": True,
                "description": item["description"],
            },
        )
        if not created and not task_obj.description:
            task_obj.description = item["description"]
            task_obj.save(update_fields=["description"])

    # Atualiza descrições de tarefas conhecidas que estejam sem descrição
    for nome, desc in DESCRICOES_PADRAO.items():
        PeriodicTask.objects.filter(name=nome, description="").update(description=desc)
        PeriodicTask.objects.filter(name=nome, description__isnull=True).update(description=desc)


def obter_status_celery() -> dict[str, Any]:
    """
    Verifica a conectividade com o Redis, tamanho das filas e workers ativos.
    """
    redis_url = getattr(settings, "CELERY_BROKER_URL", "redis://redis:6379/0")
    redis_conectado = False
    tamanho_fila_celery = 0

    try:
        r = redis.from_url(redis_url, socket_timeout=2)
        r.ping()
        redis_conectado = True
        tamanho_fila_celery = r.llen("celery")
    except Exception as exc:
        logger.warning("Falha ao consultar broker Redis: %s", exc)

    workers_ativos = []
    try:
        inspector = current_app.control.inspect(timeout=1.0)
        pings = inspector.ping() if inspector else None
        if pings:
            for worker_name in pings:
                workers_ativos.append({"nome": worker_name, "status": "ONLINE"})
    except Exception as exc:
        logger.warning("Falha ao inspecionar workers Celery: %s", exc)

    return {
        "redis_conectado": redis_conectado,
        "tamanho_fila_celery": tamanho_fila_celery,
        "total_workers": len(workers_ativos),
        "total_workers_online": len(workers_ativos),
        "filas": [
            {"nome": "celery", "tamanho": tamanho_fila_celery},
        ],
        "workers": workers_ativos,
        "workers_ativos": workers_ativos,
    }


def disparar_tarefa_periodica(periodic_task: PeriodicTask, request=None) -> str:
    """
    Dispara imediatamente uma tarefa periódica via `current_app.send_task`
    e registra trilha de auditoria.
    """
    task_name = periodic_task.task
    async_result = current_app.send_task(task_name)

    registrar_auditoria_vendor(
        request=request,
        acao=RegistroAuditoriaVendor.Acao.CELERY_TRIGGER,
        schema_alvo="public",
        detalhes={
            "tarefa_nome": periodic_task.name,
            "task": task_name,
            "task_id": async_result.id,
        },
    )

    return async_result.id
