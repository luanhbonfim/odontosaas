"""Testes da API REST de lançamentos financeiros (CRUD + ajustes manuais)."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.perfis import sincronizar_grupos

Usuario = get_user_model()


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _consulta_realizada(paciente_nome, cpf, valor):
    paciente = Paciente.objects.create(nome_completo=paciente_nome, cpf=cpf)
    dentista, _ = Dentista.objects.get_or_create(
        cro="CRO-APIFIN", defaults={"nome_completo": "Dr. Teste"}
    )
    inicio = timezone.now() + timedelta(days=1)
    consulta = Consulta.objects.create(
        paciente=paciente,
        dentista=dentista,
        inicio=inicio,
        fim=inicio + timedelta(minutes=30),
        valor=Decimal(valor),
    )
    consulta.status = Consulta.Status.REALIZADA
    consulta.save(update_fields=["status", "atualizado_em"])
    return paciente, consulta


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


@pytest.mark.django_db(transaction=True)
def test_lancamentos_filtro_por_paciente():
    host = "apifinpac.localhost"
    clinica = _criar_clinica("api_fin_pac", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            paciente_a, consulta_a = _consulta_realizada("Ana", "11111111111", "150.00")
            _paciente_b, _consulta_b = _consulta_realizada("Bia", "22222222222", "90.00")

        resp = client.get(f"/api/lancamentos/?paciente={paciente_a.id}", HTTP_HOST=host)
        assert resp.status_code == 200
        dados = resp.json()
        assert len(dados) == 1
        assert dados[0]["consulta"] == consulta_a.id
        assert dados[0]["valor"] == "150.00"
        assert dados[0]["consulta_data"] is not None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_recepcao_tem_acesso_ao_financeiro():
    host = "apifinrecep.localhost"
    clinica = _criar_clinica("api_fin_recep", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(
                email="recep@fin.com", password="Senha12345", papel="RECEPCAO"
            )

        cache.clear()
        c = APIClient()
        tok = c.post(
            "/api/auth/token/",
            {"email": "recep@fin.com", "password": "Senha12345"},
            format="json",
            HTTP_HOST=host,
        ).json()["access"]
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")

        assert c.get("/api/lancamentos/", HTTP_HOST=host).status_code == 200

        criado = c.post(
            "/api/lancamentos/",
            {"tipo": "RECEITA", "descricao": "Teste recepção", "valor": "50"},
            format="json",
            HTTP_HOST=host,
        )
        assert criado.status_code == 201, criado.content
        lid = criado.json()["id"]

        quitado = c.post(f"/api/lancamentos/{lid}/quitar/", HTTP_HOST=host)
        assert quitado.status_code == 200
        assert quitado.json()["status"] == "PAGO"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
