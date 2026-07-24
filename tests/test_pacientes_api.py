"""Testes da API REST de Paciente (CRUD + validação de CPF único)."""

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
def test_crud_paciente_e_cpf_unico():
    host = "apipacientes.localhost"
    clinica = _criar_clinica("api_pacientes", host)
    client = APIClient()
    try:
        # CREATE
        resp = client.post(
            "/api/pacientes/",
            {
                "nome_completo": "Maria Souza",
                "cpf": "12345678901",
                "telefone_whatsapp": "11988887777",
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        pid = resp.json()["id"]

        # LIST
        resp = client.get("/api/pacientes/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        # UPDATE (PATCH)
        resp = client.patch(
            f"/api/pacientes/{pid}/",
            {"email": "maria@x.com"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "maria@x.com"

        # CPF duplicado -> 400 com erro em 'cpf'
        resp = client.post(
            "/api/pacientes/",
            {"nome_completo": "Outra Maria", "cpf": "12345678901"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "cpf" in resp.json()

        # DELETE
        resp = client.delete(f"/api/pacientes/{pid}/", HTTP_HOST=host)
        assert resp.status_code == 204
        assert len(client.get("/api/pacientes/", HTTP_HOST=host).json()) == 0
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
