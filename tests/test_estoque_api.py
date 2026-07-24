"""Testes da API REST do estoque (CRUD de insumo + cálculo de saldo)."""

from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.estoque.models import Insumo
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_crud_insumo_com_categoria():
    host = "apiestoque.localhost"
    clinica = _criar_clinica("api_estoque", host)
    client = APIClient()
    try:
        # categoria
        resp = client.post(
            "/api/categorias-insumo/", {"nome": "Descartáveis"}, format="json", HTTP_HOST=host
        )
        assert resp.status_code == 201, resp.content
        cat_id = resp.json()["id"]

        # CREATE insumo
        resp = client.post(
            "/api/insumos/",
            {"nome": "Luva", "categoria": cat_id, "unidade": "CX", "estoque_minimo": "5"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        insumo_id = resp.json()["id"]
        assert resp.json()["saldo"] == "0.00"  # sem movimentações ainda

        # LIST
        resp = client.get("/api/insumos/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert len(resp.json()) == 1

        # UPDATE (PATCH)
        resp = client.patch(
            f"/api/insumos/{insumo_id}/", {"estoque_minimo": "8"}, format="json", HTTP_HOST=host
        )
        assert resp.status_code == 200
        assert resp.json()["estoque_minimo"] == "8.00"

        # DELETE
        assert client.delete(f"/api/insumos/{insumo_id}/", HTTP_HOST=host).status_code == 204
        assert len(client.get("/api/insumos/", HTTP_HOST=host).json()) == 0
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_saldo_calculado_por_movimentacoes():
    host = "apisaldo.localhost"
    clinica = _criar_clinica("api_saldo", host)
    client = APIClient()
    try:
        insumo_id = client.post(
            "/api/insumos/", {"nome": "Gaze", "unidade": "PC"}, format="json", HTTP_HOST=host
        ).json()["id"]

        # entrada 10 + entrada 5 + saída 3  => saldo 12
        for tipo, qtd in [("ENTRADA", "10"), ("ENTRADA", "5"), ("SAIDA", "3")]:
            resp = client.post(
                "/api/movimentacoes-estoque/",
                {"insumo": insumo_id, "tipo": tipo, "quantidade": qtd},
                format="json",
                HTTP_HOST=host,
            )
            assert resp.status_code == 201, resp.content

        resp = client.get(f"/api/insumos/{insumo_id}/", HTTP_HOST=host)
        assert resp.json()["saldo"] == "12.00"

        # quantidade <= 0 é rejeitada
        resp = client.post(
            "/api/movimentacoes-estoque/",
            {"insumo": insumo_id, "tipo": "ENTRADA", "quantidade": "0"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "quantidade" in resp.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_endpoint_alertas_estoque_minimo():
    host = "apialerta.localhost"
    clinica = _criar_clinica("api_alerta", host)
    client = APIClient()
    try:
        # Insumo BAIXO: mínimo 10, saldo 4
        baixo = client.post(
            "/api/insumos/",
            {"nome": "Baixo", "estoque_minimo": "10"},
            format="json",
            HTTP_HOST=host,
        ).json()["id"]
        client.post(
            "/api/movimentacoes-estoque/",
            {"insumo": baixo, "tipo": "ENTRADA", "quantidade": "4"},
            format="json",
            HTTP_HOST=host,
        )
        # Insumo OK: mínimo 2, saldo 9
        ok = client.post(
            "/api/insumos/", {"nome": "OK", "estoque_minimo": "2"}, format="json", HTTP_HOST=host
        ).json()["id"]
        client.post(
            "/api/movimentacoes-estoque/",
            {"insumo": ok, "tipo": "ENTRADA", "quantidade": "9"},
            format="json",
            HTTP_HOST=host,
        )

        # Campo estoque_baixo no detalhe
        assert client.get(f"/api/insumos/{baixo}/", HTTP_HOST=host).json()["estoque_baixo"] is True
        assert client.get(f"/api/insumos/{ok}/", HTTP_HOST=host).json()["estoque_baixo"] is False

        # Endpoint de alertas -> só o insumo baixo
        resp = client.get("/api/insumos/alertas/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert [i["nome"] for i in resp.json()] == ["Baixo"]
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_crud_consumo_insumo():
    host = "apiconsumo.localhost"
    clinica = _criar_clinica("api_consumo", host)
    client = APIClient()
    try:
        with schema_context("api_consumo"):
            paciente = Paciente.objects.create(nome_completo="P", cpf="55566677788")
            dentista = Dentista.objects.create(nome_completo="D", cro="CRO-CS")
            inicio = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=paciente,
                dentista=dentista,
                inicio=inicio,
                fim=inicio + timedelta(minutes=30),
            )
            insumo = Insumo.objects.create(nome="Luva")
            cid, iid = consulta.id, insumo.id

        # CREATE consumo
        resp = client.post(
            "/api/consumos-insumo/",
            {"consulta": cid, "insumo": iid, "quantidade": "2"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content

        # quantidade <= 0 é rejeitada
        resp = client.post(
            "/api/consumos-insumo/",
            {"consulta": cid, "insumo": iid, "quantidade": "0"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "quantidade" in resp.json()

        # LIST
        assert len(client.get("/api/consumos-insumo/", HTTP_HOST=host).json()) == 1
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
