"""
2FA (TOTP) self-service da conta do usuário da clínica (tenant), pela tela "Minha conta".

Cobre: status, ativação pendente + confirmação, desativação com código, exigência
do código no login do tenant e isolamento (opt-in por usuário).
"""

import pyotp
import pytest
from django.core.cache import cache
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio

BASE = "/api/conta/mfa"


@pytest.fixture
def tenant_clinica(db):
    """Cria (ou reaproveita) uma clínica de teste com domínio próprio."""
    clinica, _ = Clinica.objects.get_or_create(
        schema_name="clinicamfa",
        defaults={"nome_fantasia": "Clínica MFA", "razao_social": "MFA LTDA"},
    )
    Dominio.objects.get_or_create(
        domain="clinicamfa.localhost", defaults={"tenant": clinica, "is_primary": True}
    )
    return clinica


def _usuario(clinica, email="user@clinicamfa.com"):
    from apps.usuarios.models import Usuario

    with schema_context(clinica.schema_name):
        u, _ = Usuario.objects.get_or_create(
            email=email, defaults={"nome_completo": "Usuário MFA", "papel": "ADMIN"}
        )
        u.set_password("SenhaForte123")
        u.is_active = True
        u.save()
        return u.pk


@pytest.mark.django_db(transaction=True)
def test_fluxo_2fa_self_service(tenant_clinica):
    cache.clear()
    _usuario(tenant_clinica)
    from apps.usuarios.models import Usuario

    with schema_context(tenant_clinica.schema_name):
        user = Usuario.objects.get(email="user@clinicamfa.com")

    c = APIClient()
    c.force_authenticate(user)
    host = "clinicamfa.localhost"

    # status inicial
    r = c.get(f"{BASE}/", HTTP_HOST=host)
    assert r.status_code == 200, r.content
    assert r.json()["habilitado"] is False

    # iniciar -> segredo pendente (não persiste ainda)
    r = c.post(f"{BASE}/iniciar/", {}, format="json", HTTP_HOST=host)
    assert r.status_code == 200
    secret = r.json()["secret"]
    assert r.json()["otpauth_uri"].startswith("otpauth://totp/")

    # confirmar com código errado -> 400
    assert c.post(f"{BASE}/confirmar/", {"codigo": "000000"}, format="json", HTTP_HOST=host).status_code == 400

    # confirmar com código válido -> ativa
    r = c.post(f"{BASE}/confirmar/", {"codigo": pyotp.TOTP(secret).now()}, format="json", HTTP_HOST=host)
    assert r.status_code == 200, r.content
    assert r.json()["habilitado"] is True

    # desativar sem código -> 400; com código -> remove
    assert c.post(f"{BASE}/desativar/", {}, format="json", HTTP_HOST=host).status_code == 400
    r = c.post(f"{BASE}/desativar/", {"codigo": pyotp.TOTP(secret).now()}, format="json", HTTP_HOST=host)
    assert r.status_code == 200
    assert r.json()["habilitado"] is False


@pytest.mark.django_db(transaction=True)
def test_login_exige_codigo_quando_2fa_ativo(tenant_clinica):
    cache.clear()
    _usuario(tenant_clinica)
    from apps.usuarios.models import Usuario, UsuarioMFA

    secret = pyotp.random_base32()
    with schema_context(tenant_clinica.schema_name):
        user = Usuario.objects.get(email="user@clinicamfa.com")
        UsuarioMFA.objects.create(usuario=user, secret=secret)

    c = APIClient()
    host = "clinicamfa.localhost"
    url = "/api/auth/token/"

    # senha certa, sem código -> 401 com mfa_required
    r = c.post(url, {"email": "user@clinicamfa.com", "password": "SenhaForte123"}, format="json", HTTP_HOST=host)
    assert r.status_code == 401
    assert r.json().get("mfa_required") is True

    # senha certa + código válido -> 200 com tokens
    r = c.post(
        url,
        {"email": "user@clinicamfa.com", "password": "SenhaForte123", "codigo_mfa": pyotp.TOTP(secret).now()},
        format="json",
        HTTP_HOST=host,
    )
    assert r.status_code == 200, r.content
    assert "access" in r.json()


@pytest.mark.django_db(transaction=True)
def test_login_sem_2fa_nao_exige_codigo(tenant_clinica):
    cache.clear()
    _usuario(tenant_clinica, email="semfa@clinicamfa.com")

    c = APIClient()
    r = c.post(
        "/api/auth/token/",
        {"email": "semfa@clinicamfa.com", "password": "SenhaForte123"},
        format="json",
        HTTP_HOST="clinicamfa.localhost",
    )
    assert r.status_code == 200, r.content
    assert "access" in r.json()
