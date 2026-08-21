"""
Testes automatizados da Sprint V1:
- Modelos PlanoAssinatura e Clinica (novos campos, billing, overrides e helpers)
- Models RegistroAuditoriaVendor e RegistroErroOperacional
- Middleware TenantStatusMiddleware (bloqueio por inatividade/inadimplência e rotas isentas)
- Permissões IsVendorHost, IsVendorStaff e IsVendorSuperAdmin
"""

from unittest.mock import Mock

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.http import Http404, HttpResponse
from django.test import RequestFactory

from apps.plataforma.models import PlanoAssinatura
from apps.plataforma_admin.models import RegistroAuditoriaVendor, RegistroErroOperacional
from apps.plataforma_admin.permissions import (
    IsVendorHost,
    IsVendorStaff,
    IsVendorSuperAdmin,
)
from apps.tenants.models import Clinica
from config.middleware import TenantStatusMiddleware

Usuario = get_user_model()


# --------------------------------------------------------------------------
# 1. Testes de Modelos: PlanoAssinatura
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_plano_assinatura_novos_campos_defaults():
    plano = PlanoAssinatura.objects.create(
        nome="Plano Enterprise Teste",
        preco_mensal=299.90,
        limite_dentistas=10,
        limite_usuarios=20,
    )
    assert plano.preco_anual is None
    assert plano.limite_pacientes_ativos is None
    assert plano.limite_armazenamento_mb == 1024
    assert plano.modulo_financeiro_ativo is True
    assert plano.modulo_estoque_ativo is True
    assert plano.sync_google_ativo is True
    assert plano.whatsapp_waha_ativo is True
    assert plano.ativo is True
    assert str(plano) == "Plano Enterprise Teste"


@pytest.mark.django_db
def test_plano_assinatura_campos_customizados():
    plano = PlanoAssinatura.objects.create(
        nome="Plano Custom",
        preco_mensal=100.00,
        preco_anual=1000.00,
        limite_dentistas=2,
        limite_usuarios=3,
        limite_pacientes_ativos=500,
        limite_armazenamento_mb=2048,
        modulo_financeiro_ativo=False,
        modulo_estoque_ativo=False,
        sync_google_ativo=False,
        whatsapp_waha_ativo=False,
    )
    assert plano.preco_anual == 1000.00
    assert plano.limite_pacientes_ativos == 500
    assert plano.limite_armazenamento_mb == 2048
    assert plano.modulo_financeiro_ativo is False
    assert plano.modulo_estoque_ativo is False
    assert plano.sync_google_ativo is False
    assert plano.whatsapp_waha_ativo is False


# --------------------------------------------------------------------------
# 2. Testes de Modelos: Clinica (Billing, Status e Overrides)
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_clinica_status_assinatura_e_helpers():
    plano = PlanoAssinatura.objects.create(
        nome="Plano Pro",
        preco_mensal=199.00,
        limite_dentistas=5,
        limite_usuarios=10,
    )

    # Clínica sem overrides (herda do plano)
    clinica = Clinica(
        schema_name="teste_clinica_helpers",
        nome_fantasia="Clínica Helpers",
        plano_assinatura=plano,
        status_assinatura=Clinica.StatusAssinatura.ATIVA,
        ativo=True,
    )
    assert clinica.get_limite_dentistas() == 5
    assert clinica.get_limite_usuarios() == 10
    assert clinica.pode_acessar_sistema() is True

    # Clínica com overrides (prevalecem sobre o plano)
    clinica.override_limite_dentistas = 15
    clinica.override_limite_usuarios = 25
    assert clinica.get_limite_dentistas() == 15
    assert clinica.get_limite_usuarios() == 25

    # Clínica inadimplente -> não pode acessar
    clinica.status_assinatura = Clinica.StatusAssinatura.INADIMPLENTE
    assert clinica.pode_acessar_sistema() is False

    # Clínica cancelada -> não pode acessar
    clinica.status_assinatura = Clinica.StatusAssinatura.CANCELADA
    assert clinica.pode_acessar_sistema() is False

    # Clínica em trial ativa -> pode acessar
    clinica.status_assinatura = Clinica.StatusAssinatura.TRIAL
    assert clinica.pode_acessar_sistema() is True

    # Clínica inativada manualmente -> não pode acessar
    clinica.ativo = False
    assert clinica.pode_acessar_sistema() is False


# --------------------------------------------------------------------------
# 3. Testes de Modelos: RegistroAuditoriaVendor e RegistroErroOperacional
# --------------------------------------------------------------------------
@pytest.mark.django_db
def test_registro_auditoria_vendor():
    registro = RegistroAuditoriaVendor.objects.create(
        operador_email="superadmin@proclinica.cloud",
        ip_origem="192.168.1.100",
        acao=RegistroAuditoriaVendor.Acao.BLOQUEAR_CLINICA,
        schema_alvo="clinica_teste",
        detalhes={"motivo": "Inadimplência fatura #1234"},
    )
    assert registro.id is not None
    assert "superadmin@proclinica.cloud" in str(registro)
    assert "BLOQUEAR_CLINICA" in str(registro)
    assert "clinica_teste" in str(registro)


@pytest.mark.django_db
def test_registro_erro_operacional():
    registro = RegistroErroOperacional.objects.create(
        schema_tenant="mercadante",
        nivel=RegistroErroOperacional.Nivel.ERROR,
        endpoint="/api/consultas/",
        metodo="POST",
        mensagem="Conexão com WAHA expirou",
        traceback="Traceback (most recent call last)...",
        detalhes={"status_code": 504},
    )
    assert registro.id is not None
    assert "mercadante" in str(registro)
    assert "Conexão com WAHA expirou" in str(registro)


# --------------------------------------------------------------------------
# 4. Testes do TenantStatusMiddleware
# --------------------------------------------------------------------------
def test_tenant_status_middleware_schema_public_passa_direto():
    factory = RequestFactory()
    request = factory.get("/api/planos/")
    request.tenant = Mock(schema_name="public", ativo=False)

    get_response = Mock(return_value=HttpResponse("OK", status=200))
    middleware = TenantStatusMiddleware(get_response)

    response = middleware(request)
    assert response.status_code == 200
    get_response.assert_called_once_with(request)


def test_tenant_status_middleware_tenant_ativo_passa_direto():
    factory = RequestFactory()
    request = factory.get("/api/pacientes/")
    request.tenant = Mock(
        schema_name="clinica_sorriso",
        ativo=True,
        status_assinatura=Clinica.StatusAssinatura.ATIVA,
        pode_acessar_sistema=lambda: True,
    )

    get_response = Mock(return_value=HttpResponse("OK", status=200))
    middleware = TenantStatusMiddleware(get_response)

    response = middleware(request)
    assert response.status_code == 200
    get_response.assert_called_once_with(request)


def test_tenant_status_middleware_tenant_inativo_bloqueia_api():
    factory = RequestFactory()
    request = factory.get("/api/pacientes/")
    request.tenant = Mock(
        schema_name="clinica_bloqueada",
        ativo=False,
        status_assinatura=Clinica.StatusAssinatura.ATIVA,
        pode_acessar_sistema=lambda: False,
    )

    get_response = Mock()
    middleware = TenantStatusMiddleware(get_response)

    response = middleware(request)
    assert response.status_code == 403
    assert response["Content-Type"] == "application/json"
    import json

    data = json.loads(response.content)
    assert data["erro"] == "Acesso suspenso."
    assert data["motivo"] == "inativo"
    get_response.assert_not_called()


def test_tenant_status_middleware_tenant_inadimplente_bloqueia_api():
    factory = RequestFactory()
    request = factory.post("/api/consultas/")
    request.tenant = Mock(
        schema_name="clinica_devedora",
        ativo=True,
        status_assinatura=Clinica.StatusAssinatura.INADIMPLENTE,
        pode_acessar_sistema=lambda: False,
    )

    get_response = Mock()
    middleware = TenantStatusMiddleware(get_response)

    response = middleware(request)
    assert response.status_code == 403
    import json

    data = json.loads(response.content)
    assert data["erro"] == "Acesso suspenso."
    assert data["motivo"] == "inadimplente"
    get_response.assert_not_called()


def test_tenant_status_middleware_rotas_isentas():
    factory = RequestFactory()
    request_health = factory.get("/health/")
    request_tenant_atual = factory.get("/api/tenant-atual/")

    tenant_inativo = Mock(
        schema_name="clinica_inativa",
        ativo=False,
        pode_acessar_sistema=lambda: False,
    )
    request_health.tenant = tenant_inativo
    request_tenant_atual.tenant = tenant_inativo

    get_response = Mock(return_value=HttpResponse("OK", status=200))
    middleware = TenantStatusMiddleware(get_response)

    resp_health = middleware(request_health)
    assert resp_health.status_code == 200

    resp_tenant = middleware(request_tenant_atual)
    assert resp_tenant.status_code == 200


# --------------------------------------------------------------------------
# 5. Testes de Permissões: IsVendorHost, IsVendorStaff, IsVendorSuperAdmin
# --------------------------------------------------------------------------
def test_is_vendor_host_permite_apenas_public():
    permission = IsVendorHost()
    view = Mock()

    # Em schema public -> True
    req_public = Mock(tenant=Mock(schema_name="public"))
    assert permission.has_permission(req_public, view) is True

    # Em schema de tenant -> Lança Http404 (ocultamento)
    req_tenant = Mock(tenant=Mock(schema_name="mercadante"))
    with pytest.raises(Http404):
        permission.has_permission(req_tenant, view)


def test_is_vendor_staff():
    permission = IsVendorStaff()
    view = Mock()

    # Host público + superuser -> True
    user_super = Mock(is_authenticated=True, is_staff=False, is_superuser=True)
    req_super = Mock(tenant=Mock(schema_name="public"), user=user_super)
    assert permission.has_permission(req_super, view) is True

    # Host público + staff -> True
    user_staff = Mock(is_authenticated=True, is_staff=True, is_superuser=False)
    req_staff = Mock(tenant=Mock(schema_name="public"), user=user_staff)
    assert permission.has_permission(req_staff, view) is True

    # Host público + usuário comum -> False
    user_comum = Mock(is_authenticated=True, is_staff=False, is_superuser=False)
    req_comum = Mock(tenant=Mock(schema_name="public"), user=user_comum)
    assert permission.has_permission(req_comum, view) is False

    # Host público + anônimo -> False
    user_anon = Mock(is_authenticated=False)
    req_anon = Mock(tenant=Mock(schema_name="public"), user=user_anon)
    assert permission.has_permission(req_anon, view) is False

    # Host de tenant -> Http404 (mesmo sendo superuser)
    req_tenant = Mock(tenant=Mock(schema_name="mercadante"), user=user_super)
    with pytest.raises(Http404):
        permission.has_permission(req_tenant, view)


def test_is_vendor_super_admin():
    permission = IsVendorSuperAdmin()
    view = Mock()

    # Host público + superuser -> True
    user_super = Mock(is_authenticated=True, is_superuser=True)
    req_super = Mock(tenant=Mock(schema_name="public"), user=user_super)
    assert permission.has_permission(req_super, view) is True

    # Host público + staff (não superuser) -> False
    user_staff = Mock(is_authenticated=True, is_staff=True, is_superuser=False)
    req_staff = Mock(tenant=Mock(schema_name="public"), user=user_staff)
    assert permission.has_permission(req_staff, view) is False


def test_tenant_atual_view_public_vs_tenant():
    from unittest.mock import MagicMock
    from rest_framework.test import APIRequestFactory
    from apps.usuarios.views import TenantAtualView

    factory = APIRequestFactory()
    view = TenantAtualView.as_view()

    # 1. No host público (sem tenant ou tenant public)
    req_pub = factory.get("/api/tenant-atual/")
    req_pub.tenant = MagicMock(schema_name="public", nome_fantasia="Público")
    resp_pub = view(req_pub)
    assert resp_pub.status_code == 200
    assert resp_pub.data["is_public"] is True
    assert resp_pub.data["nome_fantasia"] is None

    # 2. No subdomínio do tenant
    req_tenant = factory.get("/api/tenant-atual/")
    req_tenant.tenant = MagicMock(schema_name="clinica_alfa", nome_fantasia="Clínica Alfa Odonto")
    resp_tenant = view(req_tenant)
    assert resp_tenant.status_code == 200
    assert resp_tenant.data["is_public"] is False
    assert resp_tenant.data["schema"] == "clinica_alfa"
    assert resp_tenant.data["nome_fantasia"] == "Clínica Alfa Odonto"







