"""
Instância do Celery do OdontoSaaS.

Lê a configuração das settings do Django (prefixo CELERY_) e descobre
automaticamente as tasks nos apps instalados.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("odonto")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
