"""
Gestão de 2FA (TOTP) dos operadores do Vendor Admin pela interface (sem CLI).

Cobre: status, ativação pendente + confirmação, desativação com código,
listagem/reset por SuperAdmin e bloqueio de staff não-superadmin.
"""

import pyotp
import pytest
from django.core.cache import cache
from django.db import connection
from rest_framework.test import APIClient

from apps.plataforma_admin.models import OperadorMFA
from apps.tenants.models import Clinica, Dominio

BASE = "/api/plataforma-admin/mfa"


class _Super:
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = True
    email = "super@proclinica.cloud"
    pk = 0
    id = 0


class _Staff:
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = False
    email = "staff@proclinica.cloud"
    pk = 0
    id = 0


def _cliente(operador):
    connection.set_schema_to_public()
    pub, _ = Clinica.objects.get_or_create(
        schema_name="public", defaults={"nome_fantasia": "Público", "razao_social": "P"}
    )
    Dominio.objects.get_or_create(domain="localhost", defaults={"tenant": pub, "is_primary": True})
    c = APIClient()
    c.force_authenticate(operador)
    c.defaults["HTTP_HOST"] = "localhost"
    return c


@pytest.mark.django_db(transaction=True)
def test_fluxo_self_service_ativar_confirmar_desativar():
    cache.clear()
    sup = _cliente(_Super())

    # status inicial: desativado
    r = sup.get(f"{BASE}/", HTTP_HOST="localhost")
    assert r.status_code == 200
    assert r.json()["habilitado"] is False

    # iniciar: gera segredo pendente (não ativa ainda)
    r = sup.post(f"{BASE}/iniciar/", {}, format="json", HTTP_HOST="localhost")
    assert r.status_code == 200
    secret = r.json()["secret"]
    assert r.json()["otpauth_uri"].startswith("otpauth://totp/")
    assert not OperadorMFA.objects.filter(email__iexact="super@proclinica.cloud").exists()

    # confirmar com código errado -> 400, ainda não ativa
    assert sup.post(f"{BASE}/confirmar/", {"codigo": "000000"}, format="json", HTTP_HOST="localhost").status_code == 400
    assert not OperadorMFA.objects.filter(email__iexact="super@proclinica.cloud").exists()

    # confirmar com código válido -> persiste
    codigo = pyotp.TOTP(secret).now()
    r = sup.post(f"{BASE}/confirmar/", {"codigo": codigo}, format="json", HTTP_HOST="localhost")
    assert r.status_code == 200, r.content
    assert r.json()["habilitado"] is True
    assert OperadorMFA.objects.filter(email__iexact="super@proclinica.cloud").exists()

    # desativar sem código -> 400
    assert sup.post(f"{BASE}/desativar/", {}, format="json", HTTP_HOST="localhost").status_code == 400
    assert OperadorMFA.objects.filter(email__iexact="super@proclinica.cloud").exists()

    # desativar com código válido -> remove
    codigo = pyotp.TOTP(secret).now()
    r = sup.post(f"{BASE}/desativar/", {"codigo": codigo}, format="json", HTTP_HOST="localhost")
    assert r.status_code == 200
    assert r.json()["habilitado"] is False
    assert not OperadorMFA.objects.filter(email__iexact="super@proclinica.cloud").exists()


@pytest.mark.django_db(transaction=True)
def test_confirmar_sem_pendente_falha():
    cache.clear()
    sup = _cliente(_Super())
    assert sup.post(f"{BASE}/confirmar/", {"codigo": "123456"}, format="json", HTTP_HOST="localhost").status_code == 400


@pytest.mark.django_db(transaction=True)
def test_superadmin_lista_e_reseta_outro_operador():
    cache.clear()
    OperadorMFA.objects.create(email="outro@proclinica.cloud", secret=pyotp.random_base32())
    sup = _cliente(_Super())

    r = sup.get(f"{BASE}/operadores/", HTTP_HOST="localhost")
    assert r.status_code == 200
    emails = [o["email"] for o in r.json()]
    assert "outro@proclinica.cloud" in emails

    # reset por e-mail -> remove
    r = sup.post(f"{BASE}/resetar/", {"email": "outro@proclinica.cloud"}, format="json", HTTP_HOST="localhost")
    assert r.status_code == 200
    assert r.json()["removido"] is True
    assert not OperadorMFA.objects.filter(email__iexact="outro@proclinica.cloud").exists()

    # reset sem e-mail -> 400
    assert sup.post(f"{BASE}/resetar/", {}, format="json", HTTP_HOST="localhost").status_code == 400


@pytest.mark.django_db(transaction=True)
def test_staff_nao_superadmin_bloqueado():
    cache.clear()
    stf = _cliente(_Staff())
    assert stf.get(f"{BASE}/", HTTP_HOST="localhost").status_code == 403
    assert stf.post(f"{BASE}/iniciar/", {}, format="json", HTTP_HOST="localhost").status_code == 403
    assert stf.get(f"{BASE}/operadores/", HTTP_HOST="localhost").status_code == 403
