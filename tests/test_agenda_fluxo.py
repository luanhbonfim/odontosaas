"""Testes do fluxo de atendimento da Consulta (iniciar -> finalizar)."""

from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agenda.models import Consulta
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Regra no nível do model (sem banco) ---
def test_transicoes_consulta():
    S = Consulta.Status
    assert Consulta(status=S.AGENDADA).pode_transicionar_para(S.EM_ATENDIMENTO) is True
    assert Consulta(status=S.AGENDADA).pode_transicionar_para(S.REALIZADA) is False  # pula
    assert Consulta(status=S.EM_ATENDIMENTO).pode_transicionar_para(S.REALIZADA) is True
    assert (
        Consulta(status=S.REALIZADA).pode_transicionar_para(S.EM_ATENDIMENTO) is False
    )  # terminal


@pytest.mark.django_db(transaction=True)
def test_fluxo_iniciar_finalizar():
    host = "fluxo.localhost"
    clinica = _criar_clinica("fluxo_tenant", host)
    client = APIClient()
    try:
        pac = client.post(
            "/api/pacientes/",
            {"nome_completo": "P", "cpf": "10101010101"},
            format="json",
            HTTP_HOST=host,
        ).json()
        den = client.post(
            "/api/dentistas/", {"nome_completo": "D", "cro": "CRO-9"}, format="json", HTTP_HOST=host
        ).json()
        inicio = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        consulta = client.post(
            "/api/consultas/",
            {
                "paciente": pac["id"],
                "dentista": den["id"],
                "inicio": inicio.isoformat(),
                "fim": (inicio + timedelta(minutes=30)).isoformat(),
            },
            format="json",
            HTTP_HOST=host,
        ).json()
        cid = consulta["id"]

        # Não pode finalizar sem iniciar
        assert client.post(f"/api/consultas/{cid}/finalizar/", HTTP_HOST=host).status_code == 400

        # Iniciar: AGENDADA -> EM_ATENDIMENTO
        resp = client.post(f"/api/consultas/{cid}/iniciar/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert resp.json()["status"] == "EM_ATENDIMENTO"

        # Iniciar de novo -> 400 (já iniciada)
        assert client.post(f"/api/consultas/{cid}/iniciar/", HTTP_HOST=host).status_code == 400

        # Finalizar: EM_ATENDIMENTO -> REALIZADA
        resp = client.post(f"/api/consultas/{cid}/finalizar/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert resp.json()["status"] == "REALIZADA"

        # PATCH com transição inválida (REALIZADA -> AGENDADA) -> 400
        resp = client.patch(
            f"/api/consultas/{cid}/", {"status": "AGENDADA"}, format="json", HTTP_HOST=host
        )
        assert resp.status_code == 400
        assert "status" in resp.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
