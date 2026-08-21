"""
ViewSet para gestão de tarefas periódicas do Celery Beat e status de filas/workers.
"""

from django.shortcuts import get_object_or_404
from django_celery_beat.models import (
    CrontabSchedule,
    IntervalSchedule,
    PeriodicTask,
)
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.plataforma_admin.celery_manager import (
    disparar_tarefa_periodica,
    garantir_tarefas_padrao_no_banco,
    obter_status_celery,
)
from apps.plataforma_admin.models import RegistroAuditoriaVendor
from apps.plataforma_admin.permissions import IsVendorStaff
from apps.plataforma_admin.serializers import (
    PeriodicTaskListSerializer,
    PeriodicTaskUpdateSerializer,
)
from apps.plataforma_admin.services import registrar_auditoria_vendor


class CeleryTarefasViewSet(viewsets.ViewSet):
    """
    Gestão dinâmica de PeriodicTasks do Celery Beat e monitoramento do cluster.
    """

    permission_classes = [IsVendorStaff]

    def list(self, request):
        """Lista todas as tarefas periódicas configuradas no banco."""
        garantir_tarefas_padrao_no_banco()
        tarefas = PeriodicTask.objects.select_related("interval", "crontab").order_by("name")
        serializer = PeriodicTaskListSerializer(tarefas, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        """Detalhes de uma tarefa periódica específica."""
        tarefa = get_object_or_404(
            PeriodicTask.objects.select_related("interval", "crontab"),
            pk=pk,
        )
        serializer = PeriodicTaskListSerializer(tarefa)
        return Response(serializer.data)

    def partial_update(self, request, pk=None):
        """Atualiza em runtime o status (enabled), intervalo ou cron da tarefa."""
        tarefa = get_object_or_404(
            PeriodicTask.objects.select_related("interval", "crontab"),
            pk=pk,
        )
        serializer = PeriodicTaskUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        campos_alterados = {}

        if "enabled" in dados:
            tarefa.enabled = dados["enabled"]
            campos_alterados["enabled"] = tarefa.enabled

        if "every" in dados or "period" in dados:
            every = dados.get("every") or (tarefa.interval.every if tarefa.interval else 1)
            period = dados.get("period") or (tarefa.interval.period if tarefa.interval else IntervalSchedule.MINUTES)
            intervalo, _ = IntervalSchedule.objects.get_or_create(every=every, period=period)
            tarefa.interval = intervalo
            tarefa.crontab = None
            campos_alterados["interval"] = f"{every} {period}"

        elif "crontab_minute" in dados or "crontab_hour" in dados or "crontab_day_of_week" in dados:
            minute = dados.get("crontab_minute", "*")
            hour = dados.get("crontab_hour", "*")
            day_of_week = dados.get("crontab_day_of_week", "*")
            crontab, _ = CrontabSchedule.objects.get_or_create(
                minute=minute,
                hour=hour,
                day_of_week=day_of_week,
            )
            tarefa.crontab = crontab
            tarefa.interval = None
            campos_alterados["crontab"] = f"{minute} {hour} * * {day_of_week}"

        tarefa.save()

        registrar_auditoria_vendor(
            request=request,
            acao=RegistroAuditoriaVendor.Acao.CELERY_CONFIG,
            schema_alvo="public",
            detalhes={
                "tarefa_id": tarefa.id,
                "tarefa_nome": tarefa.name,
                "alteracoes": campos_alterados,
            },
        )

        return Response(PeriodicTaskListSerializer(tarefa).data)

    @action(detail=True, methods=["post"], url_path="disparar")
    def disparar(self, request, pk=None):
        """Força o disparo imediato da tarefa no Celery."""
        tarefa = get_object_or_404(PeriodicTask, pk=pk)
        task_id = disparar_tarefa_periodica(tarefa, request=request)
        return Response(
            {
                "mensagem": f"Tarefa '{tarefa.name}' disparada com sucesso.",
                "task_name": tarefa.task,
                "task_id": task_id,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="status")
    def status_cluster(self, request):
        """Status de conectividade do Redis e contagem de workers."""
        dados = obter_status_celery()
        return Response(dados)
