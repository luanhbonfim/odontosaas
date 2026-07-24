"""Testes da regra de transição de status da Guia."""

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.pacientes.models import Guia
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Regra no nível do model (sem banco) ---
def test_transicoes_do_model():
    S = Guia.Status
    assert Guia(status=S.EMITIDA).pode_transicionar_para(S.AUTORIZADA) is True
    assert Guia(status=S.EMITIDA).pode_transicionar_para(S.GLOSADA) is True
    assert Guia(status=S.EMITIDA).pode_transicionar_para(S.EXECUTADA) is False  # pula etapa
    assert Guia(status=S.EMITIDA).pode_transicionar_para(S.PAGA) is False
    assert Guia(status=S.AUTORIZADA).pode_transicionar_para(S.EXECUTADA) is True
    assert Guia(status=S.EXECUTADA).pode_transicionar_para(S.PAGA) is True
    assert Guia(status=S.PAGA).pode_transicionar_para(S.EXECUTADA) is False  # terminal
    assert Guia(status=S.GLOSADA).pode_transicionar_para(S.AUTORIZADA) is False  # terminal


def _criar_guia(client, host, seq=1):
    paciente = client.post(
        "/api/pacientes/",
        {"nome_completo": "P", "cpf": f"7777777{seq:04d}"},
        format="json",
        HTTP_HOST=host,
    ).json()
    plano = client.post(
        "/api/planos/",
        {"paciente": paciente["id"], "operadora": "Amil"},
        format="json",
        HTTP_HOST=host,
    ).json()
    return client.post(
        "/api/guias/",
        {"plano": plano["id"], "numero_guia": "G-1", "procedimento": "X"},
        format="json",
        HTTP_HOST=host,
    ).json()


@pytest.mark.django_db(transaction=True)
def test_transicao_via_api():
    host = "transicao.localhost"
    clinica = _criar_clinica("transicao_guias", host)
    client = APIClient()
    try:
        guia = _criar_guia(client, host, seq=1)
        url = f"/api/guias/{guia['id']}/"

        def patch_status(novo):
            return client.patch(url, {"status": novo}, format="json", HTTP_HOST=host)

        # Fluxo válido completo
        assert patch_status("AUTORIZADA").status_code == 200
        assert patch_status("EXECUTADA").status_code == 200
        assert patch_status("PAGA").status_code == 200

        # PAGA é terminal -> qualquer transição falha
        resp = patch_status("EXECUTADA")
        assert resp.status_code == 400
        assert "status" in resp.json()

        # Nova guia: pular etapa (EMITIDA -> PAGA) é inválido
        guia2 = _criar_guia(client, host, seq=2)
        resp = client.patch(
            f"/api/guias/{guia2['id']}/",
            {"status": "PAGA"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "status" in resp.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
