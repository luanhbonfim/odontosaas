"""Testes da configuração do Celery e de tasks tenant-aware."""

import pytest
from django_tenants.utils import schema_context

from apps.core.tasks import contar_usuarios_do_tenant, ping
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.models import Usuario


def test_celery_app_configurado():
    """A instância do Celery lê as settings (namespace CELERY)."""
    from config.celery import app

    assert app.main == "odonto"
    assert str(app.conf.broker_url).startswith("redis://")
    assert app.conf.beat_scheduler == "django_celery_beat.schedulers:DatabaseScheduler"


def test_ping():
    """Task simples executada de forma síncrona."""
    assert ping() == "pong"


@pytest.mark.django_db(transaction=True)
def test_task_tenant_aware_conta_usuarios():
    """A task roda dentro do schema do tenant informado."""
    clinica = Clinica(schema_name="teste_celery", nome_fantasia="Clínica Celery")
    clinica.save()
    try:
        Dominio.objects.create(domain="celery.localhost", tenant=clinica, is_primary=True)
        with schema_context(clinica.schema_name):
            Usuario.objects.create_user(email="a@b.com", password="senha-123")
            Usuario.objects.create_user(email="c@d.com", password="senha-123")

        assert contar_usuarios_do_tenant(clinica.schema_name) == 2
    finally:
        clinica.delete(force_drop=True)
