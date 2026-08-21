"""
Instância do Celery do OdontoSaaS.

Lê a configuração das settings do Django (prefixo CELERY_) e descobre
automaticamente as tasks nos apps instalados.
"""

import os

from celery import Celery
from celery.signals import task_postrun, task_prerun

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("odonto")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@task_prerun.connect
def on_task_prerun(*args, **kwargs):
    """Fecha conexões antigas do banco antes de iniciar a execução da task."""
    from django.db import close_old_connections

    close_old_connections()


@task_postrun.connect
def on_task_postrun(*args, **kwargs):
    """Fecha conexões obsoletas e restaura o search_path para public ao concluir."""
    from django.db import close_old_connections, connection

    close_old_connections()
    try:
        if hasattr(connection, "set_schema_to_public"):
            connection.set_schema_to_public()
    except Exception:
        pass

