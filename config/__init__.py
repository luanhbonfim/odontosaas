# Garante que o app do Celery seja carregado quando o Django iniciar,
# para que os @shared_task usem a instância correta.
from .celery import app as celery_app

__all__ = ("celery_app",)
