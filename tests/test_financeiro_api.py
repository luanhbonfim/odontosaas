"""Testes da API REST de lançamentos financeiros (CRUD + ajustes manuais)."""

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
def test_crud_lancamento_filtro_e_quitar():
    host = "apifin.localhost"
    clinica = _criar_clinica("api_fin", host)
    client = APIClient()
    try:
        # CREATE — conta a receber (particular)
        resp = client.post(
            "/api/lancamentos/",
            {"tipo": "RECEITA", "descricao": "Atendimento particular", "valor": "150"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        rid = resp.json()["id"]
        assert resp.json()["status"] == "PENDENTE"

        # CREATE — conta a pagar (despesa)
        client.post(
            "/api/lancamentos/",
            {"tipo": "DESPESA", "descricao": "Aluguel", "valor": "1000"},
            format="json",
            HTTP_HOST=host,
        )

        # valor <= 0 é rejeitado
        resp = client.post(
            "/api/lancamentos/",
            {"tipo": "DESPESA", "descricao": "Invalido", "valor": "0"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "valor" in resp.json()

        # filtro por tipo (contas a pagar)
        despesas = client.get("/api/lancamentos/?tipo=DESPESA", HTTP_HOST=host).json()
        assert [x["descricao"] for x in despesas] == ["Aluguel"]

        # filtro por status
        pendentes = client.get("/api/lancamentos/?status=PENDENTE", HTTP_HOST=host).json()
        assert len(pendentes) == 2

        # ajuste manual (PATCH)
        resp = client.patch(
            f"/api/lancamentos/{rid}/", {"valor": "180"}, format="json", HTTP_HOST=host
        )
        assert resp.status_code == 200
        assert resp.json()["valor"] == "180.00"

        # baixa manual (quitar)
        resp = client.post(f"/api/lancamentos/{rid}/quitar/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert resp.json()["status"] == "PAGO"
        assert resp.json()["pago_em"] is not None

        # DELETE
        assert client.delete(f"/api/lancamentos/{rid}/", HTTP_HOST=host).status_code == 204
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
