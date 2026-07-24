"""Testes do model Guia + API /api/guias/."""

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.core.models import ModeloBase
from apps.pacientes.models import Guia
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_guia_config():
    assert issubclass(Guia, ModeloBase)
    assert Guia._meta.get_field("plano").many_to_one is True
    valores = {c[0] for c in Guia._meta.get_field("status").choices}
    assert valores == {"EMITIDA", "AUTORIZADA", "EXECUTADA", "GLOSADA", "PAGA"}


def test_str():
    assert str(Guia(numero_guia="G-1", status="EMITIDA")) == "Guia G-1 (Emitida)"


# --- CRUD via API (guia vinculada a um plano) ---
@pytest.mark.django_db(transaction=True)
def test_crud_guia():
    host = "apiguias.localhost"
    clinica = _criar_clinica("api_guias", host)
    client = APIClient()
    try:
        paciente = client.post(
            "/api/pacientes/",
            {"nome_completo": "Zé", "cpf": "88888888888"},
            format="json",
            HTTP_HOST=host,
        ).json()
        plano = client.post(
            "/api/planos/",
            {"paciente": paciente["id"], "operadora": "Amil"},
            format="json",
            HTTP_HOST=host,
        ).json()

        # CREATE guia (status default EMITIDA)
        resp = client.post(
            "/api/guias/",
            {
                "plano": plano["id"],
                "numero_guia": "G-2024-1",
                "procedimento": "Restauração",
                "valor": "150.00",
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        assert resp.json()["status"] == "EMITIDA"
        guia_id = resp.json()["id"]

        # LIST
        assert len(client.get("/api/guias/", HTTP_HOST=host).json()) == 1

        # UPDATE status (transição livre nesta tarefa; regra vem depois)
        resp = client.patch(
            f"/api/guias/{guia_id}/",
            {"status": "AUTORIZADA"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "AUTORIZADA"

        # status inválido -> 400
        resp = client.patch(
            f"/api/guias/{guia_id}/",
            {"status": "XPTO"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "status" in resp.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
