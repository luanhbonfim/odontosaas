"""Casos de borda de validação do módulo de dentistas (consolidação)."""

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.dentistas.models import Especialidade
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def test_especialidade_nome_e_unico():
    assert Especialidade._meta.get_field("nome").unique is True


@pytest.mark.django_db(transaction=True)
def test_campos_obrigatorios_e_criacao_com_especialidades():
    host = "validacoes.localhost"
    clinica = _criar_clinica("validacoes_tenant", host)
    client = APIClient()
    try:
        # CRO obrigatório
        resp = client.post(
            "/api/dentistas/", {"nome_completo": "Sem CRO"}, format="json", HTTP_HOST=host
        )
        assert resp.status_code == 400
        assert "cro" in resp.json()

        # nome_completo obrigatório
        resp = client.post("/api/dentistas/", {"cro": "CRO-X"}, format="json", HTTP_HOST=host)
        assert resp.status_code == 400
        assert "nome_completo" in resp.json()

        # Cria especialidades (não há API própria; via ORM no schema do tenant)
        from django_tenants.utils import schema_context

        with schema_context(clinica.schema_name):
            e1 = Especialidade.objects.create(nome="Ortodontia")
            e2 = Especialidade.objects.create(nome="Endodontia")
            ids = [e1.id, e2.id]

        # Cria dentista COM especialidades via API (lista de PKs)
        resp = client.post(
            "/api/dentistas/",
            {"nome_completo": "Dra. Ana", "cro": "CRO-1", "especialidades": ids},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        assert set(resp.json()["especialidades"]) == set(ids)
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
