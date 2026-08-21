"""
Testes consolidados de auditoria de segurança:
1. MultiTenantJWTAuthentication (rejeição de tokens sem schema, cross-tenant e escalada de privilégios).
2. Rate-limiting e lockout no VendorLoginView (HTTP 429).
3. Hardening e blindagem de comandos perigosos e funções no Database Studio.
"""

from unittest.mock import MagicMock, patch
import pytest
from django.core.cache import cache
from rest_framework import exceptions
from rest_framework.test import APIRequestFactory

from apps.plataforma_admin.studio import COMANDOS_PROIBIDOS_REGEX, executar_sql_studio
from apps.plataforma_admin.views import (
    VENDOR_LOGIN_FALHAS_MAX,
    VendorLoginView,
)
from apps.usuarios.authentication import MultiTenantJWTAuthentication


# -----------------------------------------------------------------------------
# 1. MultiTenantJWTAuthentication: Isolamento e Proteção contra Escalada
# -----------------------------------------------------------------------------
def test_jwt_sem_schema_name_e_rejeitado_no_tenant():
    """
    Garante que um token JWT SEM o claim `schema_name` seja categoricamente rejeitado
    ao tentar acessar endpoints de um tenant.
    """
    auth = MultiTenantJWTAuthentication()

    with patch("django.db.connection.schema_name", "clinica_alfa"):
        validated_token_sem_schema = {"user_id": 1}
        with pytest.raises(exceptions.AuthenticationFailed) as exc_info:
            auth.get_user(validated_token_sem_schema)
        assert "Token inválido" in str(exc_info.value) or "origem de outro tenant" in str(exc_info.value)


def test_jwt_cross_tenant_e_rejeitado_no_tenant():
    """
    Garante que um token JWT emitido para clinica_beta seja rejeitado em clinica_alfa.
    """
    auth = MultiTenantJWTAuthentication()

    with patch("django.db.connection.schema_name", "clinica_alfa"):
        token_beta = {"user_id": 1, "schema_name": "clinica_beta"}
        with pytest.raises(exceptions.AuthenticationFailed) as exc_info:
            auth.get_user(token_beta)
        assert "Token inválido" in str(exc_info.value)


def test_jwt_de_tenant_e_rejeitado_no_schema_public_vendor():
    """
    Garante que um token JWT emitido para uma clínica (mesmo com is_staff=True no tenant)
    seja categoricamente REJEITADO no schema public (Vendor Admin).
    """
    auth = MultiTenantJWTAuthentication()

    with patch("django.db.connection.schema_name", "public"):
        token_tenant = {
            "user_id": 1,
            "schema_name": "clinica_alfa",
            "is_staff": True,
        }

        with pytest.raises(exceptions.AuthenticationFailed) as exc_info:
            auth.get_user(token_tenant)

        assert "Token inválido para a plataforma vendor" in str(exc_info.value)


# -----------------------------------------------------------------------------
# 2. VendorLoginView: Proteção contra Força Bruta / Lockout
# -----------------------------------------------------------------------------
@pytest.mark.django_db
def test_vendor_login_bloqueio_forca_bruta():
    """
    Após VENDOR_LOGIN_FALHAS_MAX tentativas inválidas do mesmo IP,
    o endpoint do VendorLoginView deve retornar HTTP 429 Too Many Requests.
    """
    cache.clear()
    rf = APIRequestFactory()
    view = VendorLoginView.as_view()

    for _ in range(VENDOR_LOGIN_FALHAS_MAX):
        req = rf.post(
            "/api/plataforma-admin/auth/login/",
            {"email": "inexistente@proclinica.com.br", "password": "senha_errada"},
            REMOTE_ADDR="192.168.100.50",
        )
        req.tenant = MagicMock(schema_name="public")
        res = view(req)
        assert res.status_code == 401

    req_bloqueada = rf.post(
        "/api/plataforma-admin/auth/login/",
        {"email": "inexistente@proclinica.com.br", "password": "senha_errada"},
        REMOTE_ADDR="192.168.100.50",
    )
    req_bloqueada.tenant = MagicMock(schema_name="public")
    res_bloqueada = view(req_bloqueada)
    assert res_bloqueada.status_code == 429
    assert "Muitas tentativas" in res_bloqueada.data["detail"]


# -----------------------------------------------------------------------------
# 3. Database Studio: Blindagem contra Comandos Administrativos e Funções PG
# -----------------------------------------------------------------------------
@pytest.mark.parametrize(
    "sql_perigoso",
    [
        "SELECT pg_terminate_backend(1234);",
        "SELECT pg_cancel_backend(1234);",
        "SELECT pg_read_file('pg_hba.conf');",
        "SELECT pg_read_binary_file('server.key');",
        "SELECT pg_ls_dir('.');",
        "DO $$ BEGIN PERFORM 1; END $$;",
        "DO LANGUAGE plpgsql $$ BEGIN NULL; END $$;",
        "CREATE OR REPLACE FUNCTION pwn() RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;",
        "CREATE PROCEDURE drop_all() LANGUAGE plpgsql AS $$ BEGIN END; $$;",
        "CREATE TRIGGER trg_pwn AFTER INSERT ON usuarios_usuario EXECUTE FUNCTION pwn();",
        "ALTER USER postgres WITH PASSWORD 'novasenha';",
    ],
)
def test_studio_bloqueia_funcoes_administrativas_e_procedimentos(sql_perigoso):
    """
    Testa se regex e validador do Database Studio bloqueiam funções de sistema perigosas.
    """
    assert COMANDOS_PROIBIDOS_REGEX.search(sql_perigoso) is not None

    with patch("apps.plataforma_admin.studio.registrar_auditoria_vendor"):
        with pytest.raises((PermissionError, ValueError)):
            executar_sql_studio(
                schema_name="demo",
                sql=sql_perigoso,
                modo="RW",
                justificativa="Justificativa longa para teste de segurança da plataforma",
            )


# -----------------------------------------------------------------------------
# 4. Hardening: IP real (anti-spoof do X-Forwarded-For) e Rate-Limiting (throttle)
# -----------------------------------------------------------------------------
def test_ip_cliente_usa_ultimo_hop_do_xff():
    """
    O IP usado no lockout deve ser o ÚLTIMO hop do X-Forwarded-For (o que o Caddy
    anexa), não o primeiro — que o cliente pode forjar para burlar o bloqueio.
    """
    from apps.plataforma_admin.views import _vendor_ip_cliente
    from apps.usuarios.views import _ip_cliente

    req = MagicMock()
    # Cliente forja "1.1.1.1"; o Caddy anexa o IP real "9.9.9.9" ao final.
    req.META = {
        "HTTP_X_FORWARDED_FOR": "1.1.1.1, 2.2.2.2, 9.9.9.9",
        "REMOTE_ADDR": "10.0.0.1",
    }
    assert _ip_cliente(req) == "9.9.9.9"
    assert _vendor_ip_cliente(req) == "9.9.9.9"

    # Sem XFF, cai no REMOTE_ADDR.
    req2 = MagicMock()
    req2.META = {"REMOTE_ADDR": "10.0.0.1"}
    assert _ip_cliente(req2) == "10.0.0.1"


def test_throttle_bloqueia_apos_limite():
    """
    O throttle por-escopo devolve 429 ao exceder a taxa: com 1/min, a 2ª requisição
    do mesmo operador é barrada.
    """
    from apps.core.throttling import StudioThrottle

    cache.clear()
    req = APIRequestFactory().get("/api/plataforma-admin/studio/schemas/")
    req.user = MagicMock(pk=4242, is_authenticated=True)
    view = MagicMock()

    with patch.object(StudioThrottle, "get_rate", return_value="1/min"):
        assert StudioThrottle().allow_request(req, view) is True   # 1ª passa
        assert StudioThrottle().allow_request(req, view) is False  # 2ª barrada (429)


def test_views_sensiveis_tem_throttle_configurado():
    """Garante que os endpoints sensíveis têm throttle aplicado (wiring)."""
    from apps.core.throttling import StudioThrottle, VendorLoginThrottle
    from apps.plataforma_admin.views_studio import StudioViewSet

    assert VendorLoginThrottle in VendorLoginView.throttle_classes
    assert StudioThrottle in StudioViewSet.throttle_classes
