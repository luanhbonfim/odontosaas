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
