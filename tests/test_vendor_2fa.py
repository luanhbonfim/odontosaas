"""
2FA/TOTP do operador do Vendor Admin.

Quando existe `OperadorMFA` (schema public) para o e-mail do operador, o login
no painel passa a exigir o código TOTP válido. Sem registro, 2FA fica desativado.
"""

import pyotp
import pytest
from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.test import APIClient

from apps.plataforma_admin.models import OperadorMFA
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.models import Usuario

HOST_PAINEL = "ops-2fa-teste.localhost"
EMAIL_OP = "op-2fa@proclinica.com.br"
SENHA_OP = "SenhaOperador2FA!"
SCHEMA = "op2fa_tenant"


@pytest.mark.django_db(transaction=True)
def test_login_vendor_exige_totp_quando_ativo():
    connection.set_schema_to_public()
    publico, _ = Clinica.objects.get_or_create(
        schema_name="public", defaults={"nome_fantasia": "Público", "razao_social": "P"}
    )
    Dominio.objects.get_or_create(domain=HOST_PAINEL, defaults={"tenant": publico, "is_primary": False})

    clinica = Clinica(
        schema_name=SCHEMA, nome_fantasia="Op2FA", razao_social="x",
        ativo=True, status_assinatura=Clinica.StatusAssinatura.ATIVA,
    )
    clinica.save()
    Dominio.objects.create(domain="op2fa.localhost", tenant=clinica, is_primary=True)
    with schema_context(SCHEMA):
        Usuario.objects.create_user(
            email=EMAIL_OP, password=SENHA_OP, is_staff=True, is_superuser=True
        )

    def login(**extra):
        cache.clear()
        cli = APIClient()
        cli.defaults["HTTP_HOST"] = HOST_PAINEL
        return cli.post(
            "/api/plataforma-admin/auth/login/",
            {"email": EMAIL_OP, "password": SENHA_OP, **extra},
            format="json",
            HTTP_HOST=HOST_PAINEL,
        )

    try:
        secret = pyotp.random_base32()
        OperadorMFA.objects.create(email=EMAIL_OP, secret=secret)

        # Sem código -> 401 + mfa_required
        r = login()
        assert r.status_code == status.HTTP_401_UNAUTHORIZED
        assert r.json().get("mfa_required") is True

        # Código válido -> 200
        r_ok = login(codigo_mfa=pyotp.TOTP(secret).now())
        assert r_ok.status_code == status.HTTP_200_OK, r_ok.content
        assert "access" in r_ok.json()

        # Código errado -> 401
        r_bad = login(codigo_mfa="000000")
        assert r_bad.status_code == status.HTTP_401_UNAUTHORIZED

        # Desativado (sem OperadorMFA) -> login sem código volta a funcionar
        OperadorMFA.objects.filter(email=EMAIL_OP).delete()
        r_off = login()
        assert r_off.status_code == status.HTTP_200_OK, r_off.content
    finally:
        connection.set_schema_to_public()
        OperadorMFA.objects.filter(email=EMAIL_OP).delete()
        Dominio.objects.filter(domain__in=[HOST_PAINEL, "op2fa.localhost"]).delete()
        c = Clinica.objects.filter(schema_name=SCHEMA).first()
        if c:
            c.delete(force_drop=True)
