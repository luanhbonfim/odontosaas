"""Testes do vínculo Guia <-> Consulta (no momento do atendimento)."""

from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _paciente(client, host, nome, cpf):
    return client.post(
        "/api/pacientes/",
        {"nome_completo": nome, "cpf": cpf},
        format="json",
        HTTP_HOST=host,
    ).json()


def _consulta(client, host, paciente_id, dentista_id, dias=1):
    inicio = (timezone.now() + timedelta(days=dias)).replace(microsecond=0)
    return client.post(
        "/api/consultas/",
        {
            "paciente": paciente_id,
            "dentista": dentista_id,
            "inicio": inicio.isoformat(),
            "fim": (inicio + timedelta(minutes=30)).isoformat(),
        },
        format="json",
        HTTP_HOST=host,
    ).json()


@pytest.mark.django_db(transaction=True)
def test_vincular_guia_a_consulta():
    host = "guiaconsulta.localhost"
    clinica = _criar_clinica("guia_consulta_tenant", host)
    client = APIClient()
    try:
        pac = _paciente(client, host, "Paciente A", "11111111111")
        den = client.post(
            "/api/dentistas/", {"nome_completo": "D", "cro": "CRO-1"}, format="json", HTTP_HOST=host
        ).json()
        plano = client.post(
            "/api/planos/",
            {"paciente": pac["id"], "operadora": "Amil"},
            format="json",
            HTTP_HOST=host,
        ).json()
        guia = client.post(
            "/api/guias/",
            {"plano": plano["id"], "numero_guia": "G-1", "procedimento": "X"},
            format="json",
            HTTP_HOST=host,
        ).json()
        consulta = _consulta(client, host, pac["id"], den["id"])

        # Vincula a guia à consulta do MESMO paciente -> 200
        resp = client.patch(
            f"/api/guias/{guia['id']}/",
            {"consulta": consulta["id"]},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 200, resp.content
        assert resp.json()["consulta"] == consulta["id"]

        # Consulta de OUTRO paciente não pode ser vinculada -> 400
        pac2 = _paciente(client, host, "Paciente B", "22222222222")
        consulta2 = _consulta(client, host, pac2["id"], den["id"], dias=2)
        resp = client.patch(
            f"/api/guias/{guia['id']}/",
            {"consulta": consulta2["id"]},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "consulta" in resp.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
