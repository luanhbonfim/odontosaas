"""
Testes automatizados da Sprint V5:
- Orquestração e Gestão de PeriodicTasks do Celery Beat no banco de dados
- Listagem de tarefas periódicas padrão
- Atualização em runtime de status (enabled), intervalo e crontab
- Disparo manual de tarefas (send_task) com trilha de auditoria
- Monitoramento de saúde do cluster Celery e fila Redis
- Isolamento de host (retorno 404 em subdomínios de tenant)
"""

from unittest.mock import MagicMock, patch

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django_celery_beat.models import PeriodicTask
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.test import APIClient

from apps.plataforma.models import PlanoAssinatura
from apps.plataforma_admin.models import RegistroAuditoriaVendor
from apps.tenants.models import Clinica, Dominio

Usuario = get_user_model()


class _OperadorVendorStaff:
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = False
    email = "vendor_staff@proclinica.cloud"
    pk = 10
    id = 10


def _garantir_tenant_publico():
    connection.set_schema_to_public()
    publico, _ = Clinica.objects.get_or_create(
        schema_name="public",
        defaults={"nome_fantasia": "Público", "razao_social": "Plataforma OdontoSaaS", "ativo": True},
    )
    Dominio.objects.get_or_create(
        domain="localhost",
        tenant=publico,
        defaults={"is_primary": True},
    )
    return publico


@pytest.fixture
def vendor_staff_client(db):
    """Cliente autenticado como staff do vendor no host público."""
    _garantir_tenant_publico()
    operador = _OperadorVendorStaff()
    client = APIClient()
    client.force_authenticate(user=operador)
    client.operador = operador
    client.defaults["HTTP_HOST"] = "localhost"
    return client


@pytest.fixture
def tenant_v5(db):
    """Tenant provisionado para testes da Sprint V5."""
    connection.set_schema_to_public()
    plano = PlanoAssinatura.objects.create(
        nome="Plano V5",
        preco_mensal=299.90,
        limite_dentistas=10,
        limite_usuarios=15,
    )
    schema = "v5_tenant_test"
    dominio = "v5test.localhost"

    clinica = Clinica(
        schema_name=schema,
        nome_fantasia="Clínica Celery V5",
        razao_social="Celery V5 LTDA",
        cnpj="55666777000100",
        plano_assinatura=plano,
        ativo=True,
        status_assinatura=Clinica.StatusAssinatura.ATIVA,
    )
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)

    with schema_context(schema):
        Usuario.objects.create_user(
            email="admin@v5test.com",
            password="SenhaAdminV5Test",
            papel=Usuario.Papel.ADMIN,
            is_staff=True,
        )

    yield clinica

    connection.set_schema_to_public()
    if Clinica.objects.filter(schema_name=schema).exists():
        clinica.delete(force_drop=True)
    connection.set_schema_to_public()


# --------------------------------------------------------------------------
# 1. Listagem de Tarefas Periódicas
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_celery_listar_tarefas_padrao(vendor_staff_client):
    resp = vendor_staff_client.get("/api/plataforma-admin/celery/tarefas/")
    assert resp.status_code == status.HTTP_200_OK
    nomes = [t["name"] for t in resp.data]
    assert "sincronizar-google-incremental" in nomes
    assert "disparar-lembretes-whatsapp" in nomes
    assert "reconciliar-google" in nomes
    assert "processar-avisos" in nomes
    assert "processar-recall" in nomes


# --------------------------------------------------------------------------
# 2. Atualização em Runtime de Status e Intervalo
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_celery_atualizar_status_e_intervalo(vendor_staff_client):
    # Garante listagem inicial
    resp_list = vendor_staff_client.get("/api/plataforma-admin/celery/tarefas/")
    tarefa_info = next(t for t in resp_list.data if t["name"] == "sincronizar-google-incremental")
    tarefa_id = tarefa_info["id"]

    # PATCH para desativar e alterar intervalo
    resp_patch = vendor_staff_client.patch(
        f"/api/plataforma-admin/celery/tarefas/{tarefa_id}/",
        {"enabled": False, "every": 30, "period": "minutes"},
        format="json",
    )
    assert resp_patch.status_code == status.HTTP_200_OK
    assert resp_patch.data["enabled"] is False
    assert resp_patch.data["every"] == 30
    assert resp_patch.data["period"] == "minutes"

    # Confirma no banco
    tarefa_db = PeriodicTask.objects.get(id=tarefa_id)
    assert tarefa_db.enabled is False
    assert tarefa_db.interval.every == 30

    # Confirma auditoria
    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.CELERY_CONFIG,
        detalhes__tarefa_id=tarefa_id,
    ).exists()


# --------------------------------------------------------------------------
# 3. Atualização em Runtime para Crontab
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_celery_atualizar_para_crontab(vendor_staff_client):
    resp_list = vendor_staff_client.get("/api/plataforma-admin/celery/tarefas/")
    tarefa_id = resp_list.data[0]["id"]

    resp_patch = vendor_staff_client.patch(
        f"/api/plataforma-admin/celery/tarefas/{tarefa_id}/",
        {"crontab_minute": "0", "crontab_hour": "8", "crontab_day_of_week": "1-5"},
        format="json",
    )
    assert resp_patch.status_code == status.HTTP_200_OK
    assert resp_patch.data["tipo_agendamento"] == "CRONTAB"
    assert "0 8 * * 1-5" in resp_patch.data["agendamento_display"]

    tarefa_db = PeriodicTask.objects.get(id=tarefa_id)
    assert tarefa_db.crontab is not None
    assert tarefa_db.crontab.minute == "0"
    assert tarefa_db.crontab.hour == "8"


# --------------------------------------------------------------------------
# 4. Disparo Manual de Tarefa Periódica
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_celery_disparar_tarefa_manualmente(vendor_staff_client):
    resp_list = vendor_staff_client.get("/api/plataforma-admin/celery/tarefas/")
    tarefa_id = resp_list.data[0]["id"]

    mock_async_result = MagicMock()
    mock_async_result.id = "mock-uuid-task-12345"

    with patch("celery.current_app.send_task", return_value=mock_async_result) as mock_send:
        resp_disp = vendor_staff_client.post(f"/api/plataforma-admin/celery/tarefas/{tarefa_id}/disparar/")
        assert resp_disp.status_code == status.HTTP_200_OK
        assert resp_disp.data["task_id"] == "mock-uuid-task-12345"
        mock_send.assert_called_once()

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.CELERY_TRIGGER,
        detalhes__task_id="mock-uuid-task-12345",
    ).exists()


# --------------------------------------------------------------------------
# 5. Monitoramento de Saúde do Cluster e Filas
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_celery_status_cluster(vendor_staff_client):
    resp = vendor_staff_client.get("/api/plataforma-admin/celery/tarefas/status/")
    assert resp.status_code == status.HTTP_200_OK
    assert "redis_conectado" in resp.data
    assert "filas" in resp.data
    assert "workers" in resp.data
    assert isinstance(resp.data["filas"], list)


# --------------------------------------------------------------------------
# 6. Isolamento de Host (404 em Subdomínio de Tenant)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_celery_isolamento_host_404_em_tenant(tenant_v5):
    client = APIClient()
    client.defaults["HTTP_HOST"] = tenant_v5.domains.first().domain

    with schema_context(tenant_v5.schema_name):
        admin_user = Usuario.objects.get(email="admin@v5test.com")
    client.force_authenticate(user=admin_user)

    assert client.get("/api/plataforma-admin/celery/tarefas/").status_code == status.HTTP_404_NOT_FOUND
    assert client.get("/api/plataforma-admin/celery/tarefas/status/").status_code == status.HTTP_404_NOT_FOUND
    assert client.post("/api/plataforma-admin/celery/tarefas/1/disparar/").status_code == status.HTTP_404_NOT_FOUND


# --------------------------------------------------------------------------
# 7. Teste de Durabilidade: Settings Vazio e Preservação pós-Reboot
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_celery_beat_schedule_settings_vazio_e_persistencia_duravel(vendor_staff_client):
    from django.conf import settings

    from apps.plataforma_admin.celery_manager import garantir_tarefas_padrao_no_banco

    # 1. Confirma que o dicionário estático no settings está vazio
    assert settings.CELERY_BEAT_SCHEDULE == {}

    # 2. Garante tarefas no banco
    garantir_tarefas_padrao_no_banco()
    tarefa = PeriodicTask.objects.get(name="reconciliar-google")

    # 3. Altera o intervalo via endpoint (simula operador alterando pelo painel)
    resp = vendor_staff_client.patch(
        f"/api/plataforma-admin/celery/tarefas/{tarefa.id}/",
        {"every": 45, "period": "minutes"},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["every"] == 45

    # 4. Simula novo boot / deploy chamando a semeadura novamente
    garantir_tarefas_padrao_no_banco()

    # 5. Prova que o intervalo customizado NÃO foi revertido
    tarefa_pos_boot = PeriodicTask.objects.get(name="reconciliar-google")
    assert tarefa_pos_boot.interval.every == 45

