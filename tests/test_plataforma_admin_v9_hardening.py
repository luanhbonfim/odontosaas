"""
Suíte de Testes Consolidados da Sprint V9: Hardening de Segurança,
Isolamento Estrito Multi-Tenant, Camuflagem de Host e Validações E2E.
"""

from unittest.mock import MagicMock, patch
from django.core.cache import cache
from django.test import RequestFactory
from rest_framework.test import APIRequestFactory, force_authenticate
import pytest

from apps.plataforma_admin.permissions import IsVendorHost, IsVendorStaff, IsVendorSuperAdmin
from apps.plataforma_admin.views import (
    TenantVendorViewSet,
    PlanoAssinaturaVendorViewSet,
    VendorLoginView,
    MasterAdminVendorViewSet,
)
from apps.plataforma_admin.studio import COMANDOS_PROIBIDOS_REGEX, executar_sql_studio
from apps.usuarios.views import TenantAtualView, LoginView, EncerrarSuporteTenantView
from apps.usuarios.serializers import MultiTenantTokenObtainPairSerializer
from apps.core.handlers import sanitizar_texto_sensivel
from config.middleware import ImpersonateReadOnlyMiddleware


# -------------------------------------------------------------------------
# V9.1: Camuflagem 404 em subdomínios de tenants (IsVendorHost)
# -------------------------------------------------------------------------
@pytest.mark.django_db
def test_v9_1_camuflagem_404_em_subdominio_tenant():
    """
    Qualquer requisição para endpoints do Vendor (/api/plataforma-admin/*)
    feita a partir de um subdomínio de clínica (ex: clinica-alfa.odonto.cloud)
    deve retornar HTTP 404 (Camuflagem), simulando que a rota não existe.
    """
    rf = APIRequestFactory()
    view = TenantVendorViewSet.as_view({"get": "list"})

    # Requisição simulada com tenant NÃO público
    req_tenant = rf.get("/api/plataforma-admin/tenants/", HTTP_HOST="clinica-alfa.odonto.com.br")
    req_tenant.tenant = MagicMock(schema_name="clinica_alfa")
    
    # Criar mock user staff
    user_staff = MagicMock(is_authenticated=True, is_staff=True, is_superuser=True)
    force_authenticate(req_tenant, user=user_staff)

    res = view(req_tenant)
    assert res.status_code == 404
    assert "não encontrada" in str(res.data.get("detail")).lower() or "não encontrado" in str(res.data.get("detail")).lower()


def test_v9_1_permissao_is_vendor_host():
    """Valida a classe de permissão IsVendorHost diretamente."""
    perm = IsVendorHost()
    
    # Host público
    req_public = MagicMock(tenant=MagicMock(schema_name="public"))
    assert perm.has_permission(req_public, None) is True

    # Host de clínica
    req_tenant = MagicMock(tenant=MagicMock(schema_name="clinica_beta"))
    with pytest.raises(Exception):
        # Dispara NotFound (404)
        perm.has_permission(req_tenant, None)


# -------------------------------------------------------------------------
# V9.2: Bloqueio de Usuários Comuns de Clínica em Endpoints do Vendor
# -------------------------------------------------------------------------
def test_v9_2_bloqueio_usuario_comum_em_endpoints_vendor():
    """
    Usuários autenticados no tenant mas sem flag is_staff / is_superuser
    devem receber HTTP 403 Forbidden se tentarem acessar recursos do vendor no host público.
    """
    perm_staff = IsVendorStaff()
    perm_super = IsVendorSuperAdmin()

    user_comum = MagicMock(is_authenticated=True, is_staff=False, is_superuser=False)
    req = MagicMock(user=user_comum, tenant=MagicMock(schema_name="public"))

    assert perm_staff.has_permission(req, None) is False
    assert perm_super.has_permission(req, None) is False


@pytest.mark.django_db
def test_v9_2_bloqueio_login_vendor_para_usuario_nao_staff():
    """
    VendorLoginView deve rejeitar credenciais de usuários que não possuem
    is_staff=True ou is_superuser=True.
    """
    cache.clear()
    rf = APIRequestFactory()
    view = VendorLoginView.as_view()

    req = rf.post("/api/plataforma-admin/auth/login/", {"email": "dentista@demo.com", "password": "qualquer_senha"})
    req.tenant = MagicMock(schema_name="public")

    res = view(req)
    # Rejeitado com 401
    assert res.status_code == 401


# -------------------------------------------------------------------------
# V9.3: Bloqueio de Login de Tenant no Schema Public
# -------------------------------------------------------------------------
def test_v9_3_bloqueio_login_tenant_no_schema_public():
    """
    POST /api/auth/token/ no schema public deve ser sumariamente bloqueado.
    """
    serializer = MultiTenantTokenObtainPairSerializer()
    
    # Simula contexto de request no schema public
    mock_request = MagicMock(tenant=MagicMock(schema_name="public"))
    serializer.context["request"] = mock_request

    with pytest.raises(Exception) as exc_info:
        serializer.validate({"email": "admin@demo.com", "password": "qualquer_senha"})

    assert "subdomínio" in str(exc_info.value).lower() or "clínica" in str(exc_info.value).lower()


# -------------------------------------------------------------------------
# V9.4: Database Studio Hardening & Bloqueio de Comandos Perigosos
# -------------------------------------------------------------------------
@pytest.mark.parametrize(
    "sql_perigoso",
    [
        "DROP DATABASE odontodb;",
        "DROP TABLE usuarios_usuario;",
        "ALTER TABLE tenants_clinica DROP COLUMN id;",
        "TRUNCATE TABLE agenda_consulta;",
        "SET search_path TO public;",
        "RESET search_path;",
        "COPY usuarios_usuario TO '/tmp/dump.txt';",
        "CREATE ROLE hacker_admin WITH SUPERUSER;",
        "ALTER ROLE postgres WITH PASSWORD '123';",
        "GRANT ALL PRIVILEGES ON ALL TABLES TO public;",
    ]
)
def test_v9_4_studio_bloqueio_comandos_ddl_e_administrativos(sql_perigoso):
    """
    Comandos DDL estruturais e comandos de escape/privilégio devem ser
    detectados e bloqueados pelo validador do Database Studio.
    """
    with patch("apps.plataforma_admin.studio.registrar_auditoria_vendor"):
        with pytest.raises((PermissionError, ValueError)):
            executar_sql_studio(
                schema_name="demo",
                sql=sql_perigoso,
                modo="RW",
                justificativa="Justificativa com mais de 10 caracteres para teste de segurança",
            )


def test_v9_4_studio_modo_rw_exige_justificativa():
    """
    Em modo RW (Escrita DML), o comando UPDATE/INSERT/DELETE deve exigir
    justificativa com no mínimo 10 caracteres.
    """
    sql_dml = "UPDATE agenda_consulta SET status = 'CANCELADA' WHERE id = 99;"
    
    with patch("apps.plataforma_admin.studio.registrar_auditoria_vendor"):
        # Sem justificativa -> Dispara ValueError
        with pytest.raises(ValueError) as exc_info1:
            executar_sql_studio(schema_name="demo", sql=sql_dml, modo="RW", justificativa="")
        assert "10 caracteres" in str(exc_info1.value).lower() or "justificativa" in str(exc_info1.value).lower()

        # Justificativa curta (< 10 chars) -> Dispara ValueError
        with pytest.raises(ValueError) as exc_info2:
            executar_sql_studio(schema_name="demo", sql=sql_dml, modo="RW", justificativa="ajuste")
        assert "10 caracteres" in str(exc_info2.value).lower()


# -------------------------------------------------------------------------
# V9.5: Impersonate Read-Only Middleware Hardening
# -------------------------------------------------------------------------
def test_v9_5_impersonate_read_only_bloqueia_mutacoes():
    """
    O middleware deve bloquear requisições POST/PUT/PATCH/DELETE com 403
    quando o token contiver a flag is_impersonate / impersonate_read_only.
    """
    rf = RequestFactory()
    
    def dummy_get_response(request):
        from django.http import HttpResponse
        return HttpResponse("OK")

    middleware = ImpersonateReadOnlyMiddleware(dummy_get_response)

    req_post = rf.post("/api/pacientes/", data={"nome": "Teste"}, content_type="application/json")
    req_post.tenant = MagicMock(schema_name="clinica_teste")
    
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "jwt.decode",
            lambda *args, **kwargs: {"is_impersonate": True, "impersonate_read_only": True, "iat": 1000},
        )
        req_post.META["HTTP_AUTHORIZATION"] = "Bearer token_mock_impersonate"
        res = middleware(req_post)
        
        # Bloqueado com 403 Forbidden
        assert res.status_code == 403
        assert "somente-leitura" in res.content.decode("utf-8").lower() or "read-only" in res.content.decode("utf-8").lower()


def test_v9_5_impersonate_permite_encerrar_suporte():
    """
    A rota /api/auth/encerrar-suporte/ deve ser isenta do bloqueio do middleware
    para permitir que o operador encerre a sessão dentro do tenant.
    """
    rf = RequestFactory()

    def dummy_get_response(request):
        from django.http import HttpResponse
        return HttpResponse("Sessão encerrada com sucesso")

    middleware = ImpersonateReadOnlyMiddleware(dummy_get_response)

    req_encerrar = rf.post("/api/auth/encerrar-suporte/", data={}, content_type="application/json")
    req_encerrar.tenant = MagicMock(schema_name="clinica_teste")

    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "jwt.decode",
            lambda *args, **kwargs: {"is_impersonate": True, "impersonate_read_only": True, "iat": 1000},
        )
        req_encerrar.META["HTTP_AUTHORIZATION"] = "Bearer token_mock_impersonate"
        res = middleware(req_encerrar)
        
        # Não bloqueia com 403, segue para a view
        assert res.status_code == 200


def test_v9_5b_encerrar_suporte_exige_autenticacao():
    """
    F1 (hardening): /api/auth/encerrar-suporte/ NÃO pode ser anônima.
    Um chamador sem token válido deve receber 401 — antes era AllowAny e ainda
    decodificava o JWT sem verificar assinatura, permitindo a um anônimo encerrar
    sessões de suporte de qualquer clínica e forjar a atribuição na auditoria.
    """
    rf = APIRequestFactory()
    req = rf.post("/api/auth/encerrar-suporte/", {}, format="json")
    req.tenant = MagicMock(schema_name="clinica_teste")  # tenant ativo resolvido pelo host
    res = EncerrarSuporteTenantView.as_view()(req)
    assert res.status_code == 401


# -------------------------------------------------------------------------
# V9.6: Sanitização de Dados Sensíveis e Proteção Contra Information Disclosure
# -------------------------------------------------------------------------
def test_v9_6_sanitizacao_dados_sensiveis():
    """
    Verifica se o sanitizador mascara adequadamente connection strings,
    tokens JWT e campos sensíveis.
    """
    texto_sujo = (
        "Erro ao conectar em postgresql://odonto_user:SenhaSuperSecreta123@db.odonto.internal:5432/odontodb. "
        "Payload recebido: {'senha': 'MinhaSenhaForte2026', 'token': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID'}"
    )

    texto_limpo = sanitizar_texto_sensivel(texto_sujo)

    # Senha da connection string mascarada
    assert "SenhaSuperSecreta123" not in texto_limpo
    assert "[SENHA_DB_REDIGIDA]" in texto_limpo

    # Senha e token no JSON mascarados
    assert "MinhaSenhaForte2026" not in texto_limpo
    assert "[DADO_CONFIDENCIAL_REDIGIDO]" in texto_limpo


# -------------------------------------------------------------------------
# V9.7: Resolução do Tenant Atual (Público vs Tenant)
# -------------------------------------------------------------------------
def test_v9_7_resolucao_tenant_atual():
    """
    Valida que TenantAtualView retorna is_public: true na raiz
    e is_public: false com nome_fantasia no subdomínio do tenant.
    """
    rf = APIRequestFactory()
    view = TenantAtualView.as_view()

    # Host público
    req_public = rf.get("/api/tenant-atual/")
    req_public.tenant = MagicMock(schema_name="public")
    res_pub = view(req_public)
    assert res_pub.data.get("is_public") is True
    assert res_pub.data.get("schema") == "public"

    # Subdomínio de clínica
    req_tenant = rf.get("/api/tenant-atual/")
    req_tenant.tenant = MagicMock(schema_name="clinica_alfa", nome_fantasia="Clínica Alfa Odontologia")
    res_ten = view(req_tenant)
    assert res_ten.data.get("is_public") is False
    assert res_ten.data.get("schema") == "clinica_alfa"
    assert res_ten.data.get("nome_fantasia") == "Clínica Alfa Odontologia"
