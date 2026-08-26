"""
Testes automatizados da Sprint V3:
- Consulta e parametrização do Google Calendar por tenant (/google/ e /google/reconciliar/)
- Consulta e parametrização de WhatsApp/WAHA por tenant (/whatsapp/ e /whatsapp/reiniciar-sessao/)
- Overrides de limites e recursos por clínica (/overrides/)
- Métricas operacionais agregadas (/metricas/)
- Consulta de logs de erro filtrados (/erros/)
- Testes de isolamento de host (endpoints retornam 404 em subdomínio de tenant)
"""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.test import APIClient

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.integracoes.models import ConfiguracaoSincronizacao
from apps.notificacoes.models import ConfiguracaoNotificacao, LogNotificacao
from apps.pacientes.models import Paciente
from apps.plataforma.models import PlanoAssinatura
from apps.plataforma_admin.models import (
    RegistroAuditoriaVendor,
    RegistroErroOperacional,
)
from apps.tenants.models import Clinica, Dominio

Usuario = get_user_model()


class _OperadorVendor:
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = True
    email = "vendor_admin@proclinica.cloud"
    pk = 0
    id = 0


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
def vendor_client(db):
    """Cliente autenticado como superusuário do vendor no host público."""
    _garantir_tenant_publico()
    operador = _OperadorVendor()
    client = APIClient()
    client.force_authenticate(user=operador)
    client.operador = operador
    client.defaults["HTTP_HOST"] = "localhost"
    return client


@pytest.fixture
def tenant_v3(db):
    """Tenant de teste provisionado para a Sprint V3."""
    connection.set_schema_to_public()
    plano = PlanoAssinatura.objects.create(
        nome="Plano V3",
        preco_mensal=199.90,
        limite_dentistas=5,
        limite_usuarios=10,
    )
    schema = "v3_tenant_test"
    dominio = "v3test.localhost"

    clinica = Clinica(
        schema_name=schema,
        nome_fantasia="Clínica Teste V3",
        razao_social="Teste V3 LTDA",
        cnpj="33444555000188",
        plano_assinatura=plano,
        ativo=True,
        status_assinatura=Clinica.StatusAssinatura.ATIVA,
    )
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)

    with schema_context(schema):
        Usuario.objects.create_user(
            email="admin@v3test.com",
            password="SenhaAdminV3Test",
            papel=Usuario.Papel.ADMIN,
            is_staff=True,
        )

    yield clinica

    connection.set_schema_to_public()
    if Clinica.objects.filter(schema_name=schema).exists():
        clinica.delete(force_drop=True)
    connection.set_schema_to_public()


# --------------------------------------------------------------------------
# 1. Parâmetros Google Calendar (/google/ e /google/reconciliar/)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_google_params_e_reconciliacao(vendor_client, tenant_v3):
    # 1. GET
    resp_get = vendor_client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/google/")
    assert resp_get.status_code == status.HTTP_200_OK
    assert "intervalo_minutos" in resp_get.data
    assert "credenciais" in resp_get.data

    # 2. PATCH
    resp_patch = vendor_client.patch(
        f"/api/plataforma-admin/tenants/{tenant_v3.id}/google/",
        {"intervalo_minutos": 15},
        format="json",
    )
    assert resp_patch.status_code == status.HTTP_200_OK
    assert resp_patch.data["intervalo_minutos"] == 15

    # Valida persistência no schema do tenant
    with schema_context(tenant_v3.schema_name):
        cfg = ConfiguracaoSincronizacao.objects.first()
        assert cfg.intervalo_minutos == 15

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.PARAMETRIZACAO,
        schema_alvo=tenant_v3.schema_name,
        detalhes__tipo="google",
    ).exists()

    # 3. POST reconciliar (Mock Celery task)
    with patch("apps.integracoes.tasks.reconciliar_google.delay") as mock_task:
        resp_rec = vendor_client.post(f"/api/plataforma-admin/tenants/{tenant_v3.id}/google/reconciliar/")
        assert resp_rec.status_code == status.HTTP_200_OK
        mock_task.assert_called_once_with(schema_name=tenant_v3.schema_name)

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.CELERY_TRIGGER,
        schema_alvo=tenant_v3.schema_name,
    ).exists()


# --------------------------------------------------------------------------
# 2. Parâmetros WhatsApp (/whatsapp/ e /whatsapp/reiniciar-sessao/)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_whatsapp_params_e_restart_session(vendor_client, tenant_v3):
    # 1. GET
    with patch("apps.notificacoes.waha.status_sessao", return_value={"status": "WORKING"}):
        resp_get = vendor_client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/whatsapp/")
        assert resp_get.status_code == status.HTTP_200_OK
        assert resp_get.data["session_name"] == tenant_v3.schema_name
        assert resp_get.data["status_waha"] == "WORKING"
        assert resp_get.data["dias_antecedencia"] == 1

    # 2. PATCH
    resp_patch = vendor_client.patch(
        f"/api/plataforma-admin/tenants/{tenant_v3.id}/whatsapp/",
        {
            "dias_antecedencia": 2,
            "cancelar_nao_confirmadas": True,
            "cancelar_horas_antes": 6,
        },
        format="json",
    )
    assert resp_patch.status_code == status.HTTP_200_OK
    assert resp_patch.data["dias_antecedencia"] == 2
    assert resp_patch.data["cancelar_nao_confirmadas"] is True
    assert resp_patch.data["cancelar_horas_antes"] == 6

    with schema_context(tenant_v3.schema_name):
        cfg_zap = ConfiguracaoNotificacao.objects.first()
        assert cfg_zap.dias_antecedencia == 2
        assert cfg_zap.cancelar_nao_confirmadas is True
        assert cfg_zap.cancelar_horas_antes == 6

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.PARAMETRIZACAO,
        schema_alvo=tenant_v3.schema_name,
        detalhes__tipo="whatsapp",
    ).exists()

    # 3. POST reiniciar-sessao
    with patch("apps.notificacoes.waha.garantir_sessao", return_value=True):
        resp_restart = vendor_client.post(
            f"/api/plataforma-admin/tenants/{tenant_v3.id}/whatsapp/reiniciar-sessao/"
        )
        assert resp_restart.status_code == status.HTTP_200_OK
        assert resp_restart.data["status"] == "ok"


# --------------------------------------------------------------------------
# 3. Overrides de Limites (/overrides/)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_overrides_limites(vendor_client, tenant_v3):
    # GET inicial
    resp_get = vendor_client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/overrides/")
    assert resp_get.status_code == status.HTTP_200_OK
    assert resp_get.data["override_limite_dentistas"] is None
    assert resp_get.data["limite_dentistas_efetivo"] == 5  # herdado do plano

    # PATCH overrides
    resp_patch = vendor_client.patch(
        f"/api/plataforma-admin/tenants/{tenant_v3.id}/overrides/",
        {
            "override_limite_dentistas": 12,
            "override_limite_usuarios": 20,
            "override_recursos": {"custom_feature_vip": True},
        },
        format="json",
    )
    assert resp_patch.status_code == status.HTTP_200_OK
    assert resp_patch.data["override_limite_dentistas"] == 12
    assert resp_patch.data["limite_dentistas_efetivo"] == 12
    assert resp_patch.data["override_limite_usuarios"] == 20
    assert resp_patch.data["limite_usuarios_efetivo"] == 20
    assert resp_patch.data["override_recursos"]["custom_feature_vip"] is True

    tenant_v3.refresh_from_db()
    assert tenant_v3.get_limite_dentistas() == 12
    assert tenant_v3.get_limite_usuarios() == 20

    assert RegistroAuditoriaVendor.objects.filter(
        acao=RegistroAuditoriaVendor.Acao.PARAMETRIZACAO,
        schema_alvo=tenant_v3.schema_name,
        detalhes__tipo="overrides",
    ).exists()


# --------------------------------------------------------------------------
# 4. Métricas Operacionais Agregadas (/metricas/)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_metricas_operacionais(vendor_client, tenant_v3):
    now = timezone.now()

    # Cria dados no schema do tenant
    with schema_context(tenant_v3.schema_name):
        Paciente.objects.create(nome_completo="Paciente Metricas 1", cpf="11122233344", telefone_whatsapp="11999990001", ativo=True)
        Paciente.objects.create(nome_completo="Paciente Metricas 2", cpf="22233344455", telefone_whatsapp="11999990002", ativo=True)
        Paciente.objects.create(nome_completo="Paciente Inativo", cpf="33344455566", telefone_whatsapp="11999990003", ativo=False)

        dentista = Dentista.objects.create(nome_completo="Dr. Dentista Metricas", cro="12345", ativo=True)

        consulta = Consulta.objects.create(
            paciente=Paciente.objects.first(),
            dentista=dentista,
            inicio=now,
            fim=now + timezone.timedelta(minutes=30),
            status=Consulta.Status.AGENDADA,
        )

        LogNotificacao.objects.create(
            consulta=consulta,
            mensagem="Confirmar consulta",
            direcao=LogNotificacao.Direcao.ENVIADA,
            status=LogNotificacao.Status.ENVIADA,
        )

    resp = vendor_client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/metricas/")
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data["schema_name"] == tenant_v3.schema_name
    assert resp.data["total_pacientes_ativos"] == 2
    assert resp.data["total_dentistas_ativos"] == 1
    assert resp.data["consultas_mes_atual"] == 1
    assert resp.data["mensagens_whatsapp_mes_atual"] == 1


# --------------------------------------------------------------------------
# 5. Logs de Erros Operacionais (/erros/)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_logs_de_erros(vendor_client, tenant_v3):
    connection.set_schema_to_public()
    RegistroErroOperacional.objects.create(
        schema_tenant=tenant_v3.schema_name,
        nivel=RegistroErroOperacional.Nivel.ERROR,
        endpoint="/api/consultas/",
        metodo="POST",
        mensagem="Timeout na conexão com WhatsApp",
    )
    RegistroErroOperacional.objects.create(
        schema_tenant=tenant_v3.schema_name,
        nivel=RegistroErroOperacional.Nivel.CRITICAL,
        endpoint="/api/sync/",
        metodo="GET",
        mensagem="Token Google expirado sem refresh token",
    )
    RegistroErroOperacional.objects.create(
        schema_tenant="outro_schema",
        nivel=RegistroErroOperacional.Nivel.ERROR,
        mensagem="Erro de outra clínica",
    )

    resp = vendor_client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/erros/")
    assert resp.status_code == status.HTTP_200_OK
    itens = resp.data["results"] if isinstance(resp.data, dict) and "results" in resp.data else resp.data
    assert len(itens) == 2
    assert all(e["schema_tenant"] == tenant_v3.schema_name for e in itens)

    # Filtro por nível
    resp_crit = vendor_client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/erros/?nivel=CRITICAL")
    assert resp_crit.status_code == status.HTTP_200_OK
    itens_crit = resp_crit.data["results"] if isinstance(resp_crit.data, dict) and "results" in resp_crit.data else resp_crit.data
    assert len(itens_crit) == 1
    assert itens_crit[0]["nivel"] == "CRITICAL"


# --------------------------------------------------------------------------
# 6. Teste de Isolamento de Host Sprint V3
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_isolamento_host_endpoints_v3(tenant_v3):
    client = APIClient()
    client.defaults["HTTP_HOST"] = tenant_v3.domains.first().domain

    with schema_context(tenant_v3.schema_name):
        admin_user = Usuario.objects.get(email="admin@v3test.com")
    client.force_authenticate(user=admin_user)

    assert client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/google/").status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/whatsapp/").status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/overrides/").status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/metricas/").status_code == status.HTTP_404_NOT_FOUND
    assert client.get(f"/api/plataforma-admin/tenants/{tenant_v3.id}/erros/").status_code == status.HTTP_404_NOT_FOUND


# --------------------------------------------------------------------------
# 7. Teste de Captura Automática de Erros Operacionais (DRF Exception Handler)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_captura_automatica_erro_operacional_drf(tenant_v3):
    """Garante que exceções e erros de validação operacionais são gravados automaticamente no RegistroErroOperacional."""
    from rest_framework.exceptions import ValidationError
    from apps.core.handlers import custom_exception_handler
    from rest_framework.test import APIRequestFactory

    factory = APIRequestFactory()
    request = factory.post("/api/agenda/consultas/")
    request.tenant = tenant_v3

    exc = ValidationError("Conflito de horário: o dentista já possui consulta nesse período.")
    context = {"request": request, "view": None}

    response = custom_exception_handler(exc, context)
    assert response.status_code == status.HTTP_400_BAD_REQUEST

    connection.set_schema_to_public()
    erro = RegistroErroOperacional.objects.filter(
        schema_tenant=tenant_v3.schema_name,
        detalhes__tipo_erro="ScheduleConflictWarning",
    ).first()

    assert erro is not None
    assert erro.nivel == "WARNING"
    assert "Conflito de horário" in erro.mensagem
    assert erro.endpoint == "/api/agenda/consultas/"
    assert erro.detalhes["modulo"] == "Agenda"


# --------------------------------------------------------------------------
# 7b. NotAuthenticated pontual em /auth/me/ e /meu-plano/ não deve virar erro operacional
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("endpoint", ["/api/auth/me/", "/api/meu-plano/"])
def test_not_authenticated_bootstrap_sessao_nao_gera_erro_operacional(tenant_v3, endpoint):
    """Access token expirado/ausente ao remontar a sessão não deve poluir o painel de
    erros do vendor: o interceptor do frontend renova e refaz a chamada sozinho."""
    from rest_framework.exceptions import NotAuthenticated
    from rest_framework.test import APIRequestFactory

    from apps.core.handlers import custom_exception_handler

    factory = APIRequestFactory()
    request = factory.get(endpoint)
    request.tenant = tenant_v3

    exc = NotAuthenticated()
    context = {"request": request, "view": None}

    response = custom_exception_handler(exc, context)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

    connection.set_schema_to_public()
    assert not RegistroErroOperacional.objects.filter(
        schema_tenant=tenant_v3.schema_name,
        endpoint=endpoint,
    ).exists()


# --------------------------------------------------------------------------
# 8. Teste de Desabilitação Dinâmica de Módulos (Plano / Overrides)
# --------------------------------------------------------------------------
@pytest.mark.django_db(transaction=True)
def test_desabilitacao_modulos_plano_e_override(tenant_v3):
    """Garante que a desabilitação de Google Calendar / WhatsApp no plano ou override
    reflete nos módulos efetivos da clínica e bloqueia acessos indevidos."""
    connection.set_schema_to_public()

    plano = tenant_v3.plano_assinatura
    plano.sync_google_ativo = False
    plano.whatsapp_waha_ativo = False
    plano.save()

    # Sem overrides, herda do plano
    modulos = tenant_v3.get_modulos_efetivos()
    assert modulos["google_calendar"] is False
    assert modulos["whatsapp"] is False

    # Com override positivo para google_calendar, sobrepõe o plano
    tenant_v3.override_recursos = {"google_calendar": True}
    tenant_v3.save()
    assert tenant_v3.recurso_habilitado("google_calendar") is True
    assert tenant_v3.recurso_habilitado("whatsapp") is False

    # Valida no endpoint /api/auth/me/
    client = APIClient()
    client.defaults["HTTP_HOST"] = tenant_v3.domains.first().domain

    with schema_context(tenant_v3.schema_name):
        admin_user = Usuario.objects.get(email="admin@v3test.com")
    client.force_authenticate(user=admin_user)

    resp_me = client.get("/api/auth/me/")
    assert resp_me.status_code == status.HTTP_200_OK
    modulos_me = resp_me.data["clinica"]["modulos"]
    assert modulos_me["google_calendar"] is True
    assert modulos_me["whatsapp"] is False

    # Acesso a rota de WhatsApp desabilitada deve retornar 403 Forbidden
    resp_wa = client.get("/api/config-notificacao/whatsapp/")
    assert resp_wa.status_code == status.HTTP_403_FORBIDDEN


