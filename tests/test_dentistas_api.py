"""Testes da API REST de Dentista (CRUD + validação de CRO único)."""

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_crud_dentista_e_cro_unico():
    host = "apidentistas.localhost"
    clinica = _criar_clinica("api_dentistas", host)
    client = APIClient()
    try:
        # CREATE
        resp = client.post(
            "/api/dentistas/",
            {"nome_completo": "Dr. Fulano", "cro": "CRO-SP-1"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        dentista_id = resp.json()["id"]

        # LIST
        resp = client.get("/api/dentistas/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        # RETRIEVE
        resp = client.get(f"/api/dentistas/{dentista_id}/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert resp.json()["cro"] == "CRO-SP-1"

        # UPDATE (PATCH)
        resp = client.patch(
            f"/api/dentistas/{dentista_id}/",
            {"telefone": "11999999999"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 200
        assert resp.json()["telefone"] == "11999999999"

        # CRO duplicado -> 400 com erro no campo 'cro'
        resp = client.post(
            "/api/dentistas/",
            {"nome_completo": "Dr. Ciclano", "cro": "CRO-SP-1"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "cro" in resp.json()

        # DELETE
        resp = client.delete(f"/api/dentistas/{dentista_id}/", HTTP_HOST=host)
        assert resp.status_code == 204
        resp = client.get("/api/dentistas/", HTTP_HOST=host)
        assert len(resp.json()) == 0
    finally:
        # O middleware deixou a conexão no schema do tenant; volta ao público
        # antes de dropar o schema, para não poluir os testes seguintes.
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
