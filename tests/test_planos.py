"""Testes do model PlanoOdontologico + API /api/planos/."""

import pytest
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.core.models import ModeloBase
from apps.pacientes.models import Paciente, PlanoOdontologico
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_plano_config():
    assert issubclass(PlanoOdontologico, ModeloBase)
    assert PlanoOdontologico._meta.get_field("paciente").many_to_one is True
    valores = {c[0] for c in PlanoOdontologico._meta.get_field("status").choices}
    assert valores == {"ATIVO", "SUSPENSO", "CANCELADO"}


def test_str():
    paciente = Paciente(nome_completo="João Silva")
    plano = PlanoOdontologico(operadora="Amil Dental", paciente=paciente)
    assert str(plano) == "Amil Dental - João Silva"


# --- CRUD via API + vários por paciente ---
@pytest.mark.django_db(transaction=True)
def test_crud_e_varios_planos_por_paciente():
    host = "apiplanos.localhost"
    clinica = _criar_clinica("api_planos", host)
    client = APIClient()
    try:
        paciente = client.post(
            "/api/pacientes/",
            {"nome_completo": "Maria", "cpf": "99999999999"},
            format="json",
            HTTP_HOST=host,
        ).json()
        pid = paciente["id"]

        # dois planos para o mesmo paciente
        r1 = client.post(
            "/api/planos/",
            {"paciente": pid, "operadora": "Amil Dental"},
            format="json",
            HTTP_HOST=host,
        )
        assert r1.status_code == 201, r1.content
        assert r1.json()["status"] == "ATIVO"  # default
        r2 = client.post(
            "/api/planos/",
            {"paciente": pid, "operadora": "Uniodonto", "status": "SUSPENSO"},
            format="json",
            HTTP_HOST=host,
        )
        assert r2.status_code == 201

        # o paciente tem 2 planos
        assert len(client.get("/api/planos/", HTTP_HOST=host).json()) == 2
        with schema_context(clinica.schema_name):
            assert Paciente.objects.get(id=pid).planos.count() == 2

        # status inválido -> 400
        r = client.post(
            "/api/planos/",
            {"paciente": pid, "operadora": "X", "status": "INVALIDO"},
            format="json",
            HTTP_HOST=host,
        )
        assert r.status_code == 400
        assert "status" in r.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
