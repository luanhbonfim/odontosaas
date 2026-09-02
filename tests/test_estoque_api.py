"""Testes da API REST do estoque (CRUD de insumo + cálculo de saldo)."""

from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.estoque.models import Fornecedor, Insumo, MovimentacaoEstoque
from apps.financeiro.models import LancamentoFinanceiro
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
        assert resp.json()["categoria_nome"] == "Descartáveis"

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

        # insumo_nome exposto e filtro ?insumo= funciona
        resp = client.get("/api/movimentacoes-estoque/", HTTP_HOST=host)
        assert all(m["insumo_nome"] == "Gaze" for m in resp.json())

        outro_id = client.post(
            "/api/insumos/", {"nome": "Outro", "unidade": "UN"}, format="json", HTTP_HOST=host
        ).json()["id"]
        client.post(
            "/api/movimentacoes-estoque/",
            {"insumo": outro_id, "tipo": "ENTRADA", "quantidade": "1"},
            format="json",
            HTTP_HOST=host,
        )
        resp = client.get(
            "/api/movimentacoes-estoque/", {"insumo": insumo_id}, HTTP_HOST=host
        )
        assert len(resp.json()) == 3
        assert all(m["insumo"] == insumo_id for m in resp.json())

        # Filtro ?tipo= isola entradas de saídas
        resp = client.get("/api/movimentacoes-estoque/", {"tipo": "SAIDA"}, HTTP_HOST=host)
        assert len(resp.json()) == 1
        assert resp.json()[0]["tipo"] == "SAIDA"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_insumo_com_movimentacao_nao_pode_ser_excluido():
    host = "apiexcluiinsumo.localhost"
    clinica = _criar_clinica("api_exclui_insumo", host)
    client = APIClient()
    try:
        insumo_id = client.post(
            "/api/insumos/", {"nome": "Resina"}, format="json", HTTP_HOST=host
        ).json()["id"]
        client.post(
            "/api/movimentacoes-estoque/",
            {"insumo": insumo_id, "tipo": "ENTRADA", "quantidade": "1"},
            format="json",
            HTTP_HOST=host,
        )
        resp = client.delete(f"/api/insumos/{insumo_id}/", HTTP_HOST=host)
        assert resp.status_code == 400
        assert "vinculad" in resp.json()["detail"].lower()
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
        assert resp.json()["insumo_nome"] == "Luva"

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

        # Filtro ?consulta= isola os consumos de outra consulta
        with schema_context("api_consumo"):
            outra_consulta = Consulta.objects.create(
                paciente=paciente, dentista=dentista, inicio=inicio, fim=inicio + timedelta(minutes=30)
            )
            outra_id = outra_consulta.id
        client.post(
            "/api/consumos-insumo/",
            {"consulta": outra_id, "insumo": iid, "quantidade": "1"},
            format="json",
            HTTP_HOST=host,
        )
        resp = client.get("/api/consumos-insumo/", {"consulta": cid}, HTTP_HOST=host)
        assert len(resp.json()) == 1
        assert resp.json()[0]["consulta"] == cid
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_bloqueio_de_modulo_estoque_por_plano():
    """Regressão: a checagem de módulo por plano procurava a substring
    "/api/estoque/", que não corresponde a nenhuma rota real do app — o
    bloqueio nunca disparava. Confirma que agora dispara nas rotas reais."""
    host = "apigating.localhost"
    clinica = _criar_clinica("api_gating", host)
    client = APIClient()
    try:
        clinica.override_recursos = {"estoque": False}
        clinica.save()

        resp = client.get("/api/insumos/", HTTP_HOST=host)
        assert resp.status_code == 403
        assert "desabilitado" in resp.json()["detail"].lower()
        assert client.get("/api/categorias-insumo/", HTTP_HOST=host).status_code == 403
        assert client.get("/api/movimentacoes-estoque/", HTTP_HOST=host).status_code == 403
        assert client.get("/api/consumos-insumo/", HTTP_HOST=host).status_code == 403
        assert client.get("/api/fornecedores/", HTTP_HOST=host).status_code == 403

        clinica.override_recursos = {"estoque": True}
        clinica.save()
        assert client.get("/api/insumos/", HTTP_HOST=host).status_code == 200
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_crud_fornecedor():
    host = "apifornecedor.localhost"
    clinica = _criar_clinica("api_fornecedor", host)
    client = APIClient()
    try:
        resp = client.post("/api/fornecedores/", {"nome": "Dental Center"}, format="json", HTTP_HOST=host)
        assert resp.status_code == 201, resp.content
        fid = resp.json()["id"]

        assert len(client.get("/api/fornecedores/", HTTP_HOST=host).json()) == 1

        resp = client.patch(
            f"/api/fornecedores/{fid}/", {"nome": "Dental Center LTDA"}, format="json", HTTP_HOST=host
        )
        assert resp.status_code == 200
        assert resp.json()["nome"] == "Dental Center LTDA"

        assert client.delete(f"/api/fornecedores/{fid}/", HTTP_HOST=host).status_code == 204
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_entrada_por_compra_gera_conta_a_pagar():
    host = "apicompra.localhost"
    clinica = _criar_clinica("api_compra", host)
    client = APIClient()
    try:
        insumo_id = client.post(
            "/api/insumos/", {"nome": "Anestésico"}, format="json", HTTP_HOST=host
        ).json()["id"]
        fornecedor_id = client.post(
            "/api/fornecedores/", {"nome": "Dental Center"}, format="json", HTTP_HOST=host
        ).json()["id"]

        # Ajuste simples (default) não gera conta nenhuma.
        resp = client.post(
            "/api/movimentacoes-estoque/",
            {"insumo": insumo_id, "tipo": "ENTRADA", "quantidade": "10"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        assert resp.json()["subtipo"] == "AJUSTE"
        assert resp.json()["lancamento_financeiro_detalhe"] is None

        # Compra sem fornecedor/valor é rejeitada.
        resp = client.post(
            "/api/movimentacoes-estoque/",
            {"insumo": insumo_id, "tipo": "ENTRADA", "quantidade": "20", "subtipo": "COMPRA"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "fornecedor" in resp.json()

        # Saída não aceita subtipo COMPRA (é normalizada para AJUSTE).
        resp = client.post(
            "/api/movimentacoes-estoque/",
            {
                "insumo": insumo_id,
                "tipo": "SAIDA",
                "quantidade": "1",
                "subtipo": "COMPRA",
                "fornecedor": fornecedor_id,
                "valor": "50",
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        assert resp.json()["subtipo"] == "AJUSTE"

        # Compra completa: gera a conta a pagar (DESPESA/PENDENTE) e vincula.
        resp = client.post(
            "/api/movimentacoes-estoque/",
            {
                "insumo": insumo_id,
                "tipo": "ENTRADA",
                "quantidade": "20",
                "subtipo": "COMPRA",
                "fornecedor": fornecedor_id,
                "valor": "150.00",
                "forma_pagamento": "BOLETO",
                "data_vencimento": "2026-09-15",
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        movimentacao_id = resp.json()["id"]
        detalhe = resp.json()["lancamento_financeiro_detalhe"]
        assert detalhe["valor"] == "150.00"
        assert detalhe["fornecedor_nome"] == "Dental Center"
        assert detalhe["status"] == "PENDENTE"

        lancamento = LancamentoFinanceiro.objects.get(id=detalhe["id"])
        assert lancamento.tipo == LancamentoFinanceiro.Tipo.DESPESA
        assert lancamento.forma_pagamento == "BOLETO"
        assert str(lancamento.vencimento) == "2026-09-15"

        # Excluir a movimentação cancela a conta (ainda PENDENTE).
        assert client.delete(f"/api/movimentacoes-estoque/{movimentacao_id}/", HTTP_HOST=host).status_code == 204
        lancamento.refresh_from_db()
        assert lancamento.status == LancamentoFinanceiro.Status.CANCELADO
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_excluir_compra_ja_paga_nao_cancela_conta():
    host = "apicomprapaga.localhost"
    clinica = _criar_clinica("api_compra_paga", host)
    client = APIClient()
    try:
        with schema_context("api_compra_paga"):
            insumo = Insumo.objects.create(nome="Broca")
            fornecedor = Fornecedor.objects.create(nome="Dental Center")
            lancamento = LancamentoFinanceiro.objects.create(
                tipo=LancamentoFinanceiro.Tipo.DESPESA,
                descricao="Compra de insumo - Broca (Dental Center)",
                valor="80.00",
                fornecedor=fornecedor,
                status=LancamentoFinanceiro.Status.PAGO,
            )
            movimentacao = MovimentacaoEstoque.objects.create(
                insumo=insumo,
                tipo=MovimentacaoEstoque.Tipo.ENTRADA,
                subtipo=MovimentacaoEstoque.Subtipo.COMPRA,
                quantidade="5",
                lancamento_financeiro=lancamento,
            )
            movimentacao_id = movimentacao.id

        assert client.delete(f"/api/movimentacoes-estoque/{movimentacao_id}/", HTTP_HOST=host).status_code == 204
        lancamento.refresh_from_db()
        assert lancamento.status == LancamentoFinanceiro.Status.PAGO
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
