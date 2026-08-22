"""
Endpoint de Configurações de Login & Sessão do Vendor Admin.
GET/PATCH restritos a SuperAdmin; validação de faixas; persistência.
"""

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio

URL = "/api/plataforma-admin/config-login/"


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
def test_config_login_get_patch_superadmin():
    sup = _cliente(_Super())

    # GET -> 200 com os campos
    r = sup.get(URL, HTTP_HOST="localhost")
    assert r.status_code == 200
    assert "refresh_token_horas" in r.json()
    assert "access_token_min" in r.json()

    # PATCH válido -> persiste
    r2 = sup.patch(URL, {"access_token_min": 45, "refresh_token_horas": 8}, format="json", HTTP_HOST="localhost")
    assert r2.status_code == 200, r2.content
    assert r2.json()["access_token_min"] == 45
    assert r2.json()["refresh_token_horas"] == 8


@pytest.mark.django_db(transaction=True)
def test_config_login_bloqueia_staff_nao_superadmin():
    stf = _cliente(_Staff())
    assert stf.get(URL, HTTP_HOST="localhost").status_code == 403
    assert stf.patch(URL, {"access_token_min": 30}, format="json", HTTP_HOST="localhost").status_code == 403


@pytest.mark.django_db(transaction=True)
def test_config_login_valida_faixas_e_formato():
    sup = _cliente(_Super())
    # abaixo do mínimo (5)
    assert sup.patch(URL, {"access_token_min": 1}, format="json", HTTP_HOST="localhost").status_code == 400
    # acima do máximo (720)
    assert sup.patch(URL, {"refresh_token_horas": 99999}, format="json", HTTP_HOST="localhost").status_code == 400
    # formato de throttle inválido
    assert sup.patch(URL, {"throttle_studio": "abc"}, format="json", HTTP_HOST="localhost").status_code == 400
    # "0/min" derrubaria o login do painel (num_requests=0 => 429 sempre) -> rejeitado
    assert sup.patch(URL, {"throttle_vendor_login": "0/min"}, format="json", HTTP_HOST="localhost").status_code == 400
    # zeros à esquerda e taxa absurda (desligaria a defesa) -> rejeitados
    assert sup.patch(URL, {"throttle_impersonate": "00/min"}, format="json", HTTP_HOST="localhost").status_code == 400
    assert (
        sup.patch(URL, {"throttle_studio": "999999999/sec"}, format="json", HTTP_HOST="localhost").status_code == 400
    )
    # limite superior válido ainda passa
    assert sup.patch(URL, {"throttle_studio": "60/min"}, format="json", HTTP_HOST="localhost").status_code == 200
