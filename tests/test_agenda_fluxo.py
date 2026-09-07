"""Testes do fluxo de atendimento da Consulta (iniciar -> finalizar)."""

from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agenda.models import Consulta
from apps.pacientes.models import Guia, PlanoOdontologico
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


@pytest.mark.django_db(transaction=True)
def test_confirmar_manualmente():
    host = "confmanual.localhost"
    clinica = _criar_clinica("conf_manual_tenant", host)
    client = APIClient()
    try:
        pac = client.post(
            "/api/pacientes/",
            {"nome_completo": "P", "cpf": "20202020202"},
            format="json",
            HTTP_HOST=host,
        ).json()
        den = client.post(
            "/api/dentistas/", {"nome_completo": "D", "cro": "CRO-10"}, format="json", HTTP_HOST=host
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
        assert consulta["status_confirmacao"] == "PENDENTE"

        resp = client.post(f"/api/consultas/{cid}/confirmar_manualmente/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert resp.json()["status_confirmacao"] == "MANUAL"
        assert resp.json()["confirmado_em"] is not None

        # Já confirmada (manual ou via WhatsApp) -> 400 ao tentar de novo.
        assert (
            client.post(f"/api/consultas/{cid}/confirmar_manualmente/", HTTP_HOST=host).status_code
            == 400
        )

        # Conta como "confirmado" pras regras que dependem disso (reagendamento).
        novo_inicio = inicio + timedelta(hours=1)
        resp = client.patch(
            f"/api/consultas/{cid}/",
            {
                "inicio": novo_inicio.isoformat(),
                "fim": (novo_inicio + timedelta(minutes=30)).isoformat(),
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 200
        obj = Consulta.objects.get(pk=cid)
        assert obj.reagendada_em is not None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_tem_lancamento_e_tem_guia():
    """`tem_lancamento`/`tem_guia` refletem se já existe pagamento/guia vinculado
    — tanto no caminho anotado (lista, `ConsultaViewSet.get_queryset`) quanto no
    fallback `.exists()` (criação/detalhe, sem a anotação)."""
    host = "pagvinculo.localhost"
    clinica = _criar_clinica("pag_vinculo_tenant", host)
    client = APIClient()
    try:
        pac = client.post(
            "/api/pacientes/",
            {"nome_completo": "P", "cpf": "30303030303"},
            format="json",
            HTTP_HOST=host,
        ).json()
        den = client.post(
            "/api/dentistas/", {"nome_completo": "D", "cro": "CRO-11"}, format="json", HTTP_HOST=host
        ).json()
        inicio = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        consulta = client.post(
            "/api/consultas/",
            {
                "paciente": pac["id"],
                "dentista": den["id"],
                "inicio": inicio.isoformat(),
                "fim": (inicio + timedelta(minutes=30)).isoformat(),
                "valor": "100.00",
            },
            format="json",
            HTTP_HOST=host,
        ).json()
        cid = consulta["id"]
        # Caminho de criação (sem anotação, cai no .exists()): recém-criada, nada ainda.
        assert consulta["tem_lancamento"] is False
        assert consulta["tem_guia"] is False

        for novo in ("EM_ATENDIMENTO", "REALIZADA"):
            resp = client.patch(
                f"/api/consultas/{cid}/", {"status": novo}, format="json", HTTP_HOST=host
            )
        # Realizada mas sem forma de pagamento ainda -> nenhum lançamento gerado.
        assert resp.json()["tem_lancamento"] is False

        # Registrar o pagamento (forma de pagamento) gera o lançamento.
        resp = client.patch(
            f"/api/consultas/{cid}/", {"forma_pagamento": "PIX"}, format="json", HTTP_HOST=host
        )
        assert resp.json()["tem_lancamento"] is True
        assert resp.json()["tem_guia"] is False

        # Caminho de lista (anotado via get_queryset) reflete o mesmo estado.
        lista = client.get("/api/consultas/", HTTP_HOST=host).json()
        item = next(c for c in lista if c["id"] == cid)
        assert item["tem_lancamento"] is True
        assert item["tem_guia"] is False

        # Vincular uma Guia à consulta -> tem_guia vira true (nos dois caminhos).
        plano = PlanoOdontologico.objects.create(paciente_id=pac["id"], operadora="Amil")
        Guia.objects.create(
            plano=plano, numero_guia="G-1", procedimento="Teste", consulta_id=cid
        )
        resp = client.get(f"/api/consultas/{cid}/", HTTP_HOST=host)
        assert resp.json()["tem_guia"] is True
        lista = client.get("/api/consultas/", HTTP_HOST=host).json()
        item = next(c for c in lista if c["id"] == cid)
        assert item["tem_guia"] is True
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
