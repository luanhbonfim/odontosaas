"""
Tasks Celery de uso geral e utilitários tenant-aware.

Como o sistema é multi-tenant (schema-per-tenant), tasks que mexem em dados de
uma clínica precisam rodar dentro do schema correto. O padrão é receber o
`schema_name` e usar `schema_context(...)` do django-tenants.
"""

from celery import shared_task
from django_tenants.utils import schema_context


@shared_task
def ping():
    """Task simples de verificação de saúde do Celery."""
    return "pong"


@shared_task
def contar_usuarios_do_tenant(schema_name):
    """
    Exemplo de task tenant-aware: conta os usuários dentro do schema informado.

    Serve de modelo para as tasks de negócio das próximas sprints (lembretes,
    sincronização com Google Agenda, etc.), que sempre operam no schema de uma
    clínica específica.
    """
    from apps.usuarios.models import Usuario

    with schema_context(schema_name):
        return Usuario.objects.count()
