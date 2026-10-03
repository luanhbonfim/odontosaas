"""Testes do endpoint/serviço do Dashboard (`apps.dashboard`)."""

from datetime import date, datetime, timedelta
from decimal import Decimal
from types import SimpleNamespace
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.agenda.models import Consulta
from apps.dashboard.services import calcular_dashboard, calcular_janelas, calcular_variacao
from apps.dentistas.models import Dentista
from apps.estoque.models import Insumo, MovimentacaoEstoque
from apps.financeiro.models import LancamentoFinanceiro
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.perfis import sincronizar_grupos

Usuario = get_user_model()
SP = ZoneInfo("America/Sao_Paulo")
# Quarta-feira 07/10/2026, 14:00 em São Paulo.
AGORA = datetime(2026, 10, 7, 14, 0, tzinfo=SP)


# --------------------------------------------------------------------------
# Puros (sem banco): janelas like-for-like e variação
# --------------------------------------------------------------------------
def test_janela_mes_like_for_like():
    j = calcular_janelas("mes", date(2026, 10, 3))
    assert (j.inicio, j.fim) == (date(2026, 10, 1), date(2026, 10, 3))
    assert (j.inicio_ant, j.fim_ant) == (date(2026, 9, 1), date(2026, 9, 3))


def test_janela_mes_clamp_dia_31():
    j = calcular_janelas("mes", date(2026, 3, 31))
    assert j.fim_ant == date(2026, 2, 28)


def test_janela_semestre_cruza_ano():
    j = calcular_janelas("semestre", date(2026, 2, 15))
    assert j.inicio == date(2025, 9, 1)  # 6 meses incluindo fev/2026
    assert j.inicio_ant == date(2025, 3, 1)
    assert j.fim_ant == date(2025, 8, 15)


def test_janela_ano_bissexto():
    j = calcular_janelas("ano", date(2028, 2, 29))
    assert j.inicio == date(2028, 1, 1)
    assert (j.inicio_ant, j.fim_ant) == (date(2027, 1, 1), date(2027, 2, 28))


def test_variacao():
    assert calcular_variacao(150, 100) == 50.0
    assert calcular_variacao(100, 0) is None  # sem base
    assert calcular_variacao(0, 0) is None
    assert calcular_variacao(100, -10) is None  # base negativa engana
    assert calcular_variacao(None, 10) is None
    assert calcular_variacao(Decimal("100"), Decimal("300")) == -66.7  # 1 casa


# --------------------------------------------------------------------------
# Com banco: um tenant com cenário denso (criar schema é lento)
# --------------------------------------------------------------------------
def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _admin():
    return SimpleNamespace(papel="ADMIN", has_perm=lambda _perm: True)


def _consulta(paciente, dentista, inicio, minutos=30, status="AGENDADA", conf="PENDENTE", valor="0"):
    c = Consulta.objects.create(
        paciente=paciente,
        dentista=dentista,
        inicio=inicio,
        fim=inicio + timedelta(minutes=minutos),
        valor=Decimal(valor),
    )
    # .update() não dispara os signals de geração de conta/baixa.
    Consulta.objects.filter(pk=c.pk).update(status=status, status_confirmacao=conf)
    return c


def _lanc(tipo, valor, pago_em=None, categoria="", status=None, fornecedor=None):
    return LancamentoFinanceiro.objects.create(
        tipo=tipo,
        descricao="x",
        valor=Decimal(valor),
        status=status or (LancamentoFinanceiro.Status.PAGO if pago_em else "PENDENTE"),
        pago_em=pago_em,
        categoria=categoria,
        fornecedor=fornecedor,
    )


@pytest.mark.django_db(transaction=True)
def test_servico_cenario_completo():
    clinica = _criar_clinica("dash_servico", "dashservico.localhost")
    try:
        with schema_context(clinica.schema_name):
            pac = Paciente.objects.create(nome_completo="Ana", cpf="11122233301", telefone_whatsapp="5518999990001")
            pac_inativo = Paciente.objects.create(nome_completo="Bia", cpf="11122233302", ativo=False)
            assert pac_inativo.ativo is False
            den = Dentista.objects.create(nome_completo="Dr. A", cro="DASH-1")
            h = lambda hh, mm=0, dia=7: datetime(2026, 10, dia, hh, mm, tzinfo=SP)  # noqa: E731

            _consulta(pac, den, h(10), conf="CONFIRMADA")  # hoje, confirmada
            _consulta(pac, den, h(16), conf="PENDENTE")  # hoje, pendente (futura)
            _consulta(pac, den, h(11), status="CANCELADA")  # não conta
            _consulta(pac, den, h(13, 30), minutos=60, status="EM_ATENDIMENTO", conf="MANUAL")
            _consulta(pac, den, h(8), status="AGENDADA", conf="CONFIRMADA")  # já passou
            _consulta(pac, den, h(9, 0, dia=6), status="REALIZADA", conf="CONFIRMADA")
            _consulta(pac, den, h(9, 0, dia=3), status="FALTOU")
            # domingo 11/10 (semana atual) com 1 pendente
            _consulta(pac, den, h(9, 0, dia=11), conf="PENDENTE")

            # ---- Financeiro
            _lanc("RECEITA", "100", pago_em=h(12, dia=2))
            _lanc("DESPESA", "40", pago_em=h(12, dia=2), categoria="MATERIAIS")
            _lanc("DESPESA", "10", pago_em=h(12, dia=2))  # sem categoria
            _lanc("RECEITA", "50", pago_em=datetime(2026, 9, 2, 12, tzinfo=SP))  # like-for-like anterior
            _lanc("RECEITA", "1000", pago_em=datetime(2026, 9, 20, 12, tzinfo=SP))  # fora do trecho comparável
            _lanc("RECEITA", "7", pago_em=datetime(2026, 10, 1, 2, 30, tzinfo=ZoneInfo("UTC")))  # 30/09 23:30 local
            _lanc("RECEITA", "30")  # pendente -> a receber
            _lanc("DESPESA", "20", status="CANCELADO")  # ignorado
            LancamentoFinanceiro.objects.create(  # PAGO sem pago_em: fora do caixa
                tipo="RECEITA", descricao="x", valor=Decimal("999"), status="PAGO"
            )

            # ---- Estoque
            a = Insumo.objects.create(nome="Luva", estoque_minimo=Decimal("10"))
            MovimentacaoEstoque.objects.create(insumo=a, tipo="ENTRADA", quantidade=Decimal("10"))
            saida = MovimentacaoEstoque.objects.create(insumo=a, tipo="SAIDA", quantidade=Decimal("3"))
            MovimentacaoEstoque.objects.filter(pk=saida.pk).update(criado_em=h(9, dia=2))
            e = Insumo.objects.create(nome="Seringa", estoque_minimo=Decimal("5"))
            MovimentacaoEstoque.objects.create(insumo=e, tipo="ENTRADA", quantidade=Decimal("5"))  # igualdade
            zero = Insumo.objects.create(nome="Sem minimo")  # mínimo 0 nunca alerta
            MovimentacaoEstoque.objects.create(insumo=zero, tipo="ENTRADA", quantidade=Decimal("1"))
            Insumo.objects.create(nome="Inativo", estoque_minimo=Decimal("5"), ativo=False)

            dados = calcular_dashboard(_admin(), "mes", agora=AGORA)
            sem_ent = calcular_dashboard(_admin(), "semestre", agora=AGORA)

        at = dados["atendimento"]
        # hoje: 10h, 16h, EM_ATENDIMENTO 13:30, passada 8h (cancelada fora) = 4
        assert at["consultas_hoje"]["valor"] == 4
        assert at["pacientes_ativos"]["valor"] == 1  # inativo fora
        por_dia = {d["data"]: d for d in at["consultas_por_dia"]}
        assert len(at["consultas_por_dia"]) == 7
        assert por_dia["2026-10-05"]["confirmadas"] == 0 and por_dia["2026-10-05"]["pendentes"] == 0
        assert por_dia["2026-10-06"]["confirmadas"] == 1
        assert por_dia["2026-10-07"]["confirmadas"] == 3  # 10h, 13:30 (MANUAL), 8h
        assert por_dia["2026-10-07"]["pendentes"] == 1  # 16h (cancelada não conta)
        assert por_dia["2026-10-11"]["pendentes"] == 1
        assert at["consultas_por_dia"][0]["dia"] == "Seg"
        status = {s["status"]: s["total"] for s in at["consultas_por_status"]}
        assert status["canceladas"] == 1 and status["faltaram"] == 1 and status["realizadas"] == 1
        assert status["em_atendimento"] == 1
        # próximas: exclui a passada das 8h e a cancelada; inclui a EM_ATENDIMENTO em andamento
        proximas = at["proximas_consultas"]
        assert [p["status"] for p in proximas][0] == "EM_ATENDIMENTO"
        assert all(p["paciente"] == "Ana" for p in proximas)
        assert len(proximas) <= 5
        assert at["confirmacoes_pendentes"] == 2  # 16h hoje + domingo
        # taxa: janela 01–07/10 exceto canceladas = 6 (4 de hoje + dia 6 + faltou do dia 3; o
        # domingo 11 fica fora da janela); confirmadas/manual = 4 (10h, 13:30, 8h, dia 6)
        assert at["taxa_confirmacao"]["valor"] == round(4 / 6 * 100, 1)

        fin = dados["financeiro"]
        assert fin["contas_a_receber"]["valor"] == Decimal("30")
        assert fin["faturamento_bruto"]["valor"] == Decimal("100")
        assert fin["faturamento_liquido"]["valor"] == Decimal("50")
        assert fin["faturamento_bruto"]["variacao"] == 100.0  # 100 vs 50 (like-for-like)
        cats = {c["categoria"]: c["valor"] for c in fin["despesas_por_categoria"]}
        assert cats == {"MATERIAIS": Decimal("40"), "SEM_CATEGORIA": Decimal("10")}
        assert len(fin["fluxo_caixa"]) == 1

        meses = {m["mes"]: m for m in sem_ent["financeiro"]["fluxo_caixa"]}
        assert list(meses)[0] == "2026-05" and len(meses) == 6
        # 30/09 23:30 local pertence a setembro (UTC já seria outubro)
        assert meses["2026-09"]["entradas"] == Decimal("1057")  # 50 + 1000 + 7
        assert meses["2026-10"]["entradas"] == Decimal("100")
        assert meses["2026-08"]["entradas"] == Decimal("0")  # mês vazio preenchido

        est = dados["estoque"]
        # baixos: Luva (saldo 7 <= 10) e Seringa (5 == 5, igualdade); Sem minimo e inativo fora
        assert est["insumos_abaixo_minimo"]["valor"] == 2
        assert {i["item"] for i in est["estoque_baixo"]} == {"Luva", "Seringa"}
        assert est["estoque_baixo"][0]["item"] == "Luva"  # mais crítico (7/10 < 5/5? -> 0.7 < 1.0)
        assert est["itens_em_estoque"]["valor"] == 3  # Luva, Seringa, Sem minimo (saldo > 0)
        assert est["materiais_gastos"]["valor"] == Decimal("3")
        assert est["materiais_consumidos"][0]["material"] == "Luva"
        assert est["custo_de_materiais"]["valor"] == Decimal("40")
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


# --------------------------------------------------------------------------
# API: permissões, módulo do plano, escopo do dentista, validação do período
# --------------------------------------------------------------------------
def _cliente(host, email):
    cache.clear()
    c = APIClient()
    tok = c.post(
        "/api/auth/token/", {"email": email, "password": "Senha12345"}, format="json", HTTP_HOST=host
    ).json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
    return c


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_api_permissoes_escopo_e_modulo():
    host = "dashapi.localhost"
    clinica = _criar_clinica("dash_api", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(email="adm@c.com", password="Senha12345", papel="ADMIN")
            u1 = Usuario.objects.create_user(email="d1@c.com", password="Senha12345", papel="DENTISTA")
            Usuario.objects.create_user(email="semcad@c.com", password="Senha12345", papel="DENTISTA")
            Usuario.objects.create_user(email="rec@c.com", password="Senha12345", papel="RECEPCAO")
            d1 = Dentista.objects.create(nome_completo="D1", cro="DAPI-1", usuario=u1)
            d2 = Dentista.objects.create(nome_completo="D2", cro="DAPI-2")
            pac = Paciente.objects.create(nome_completo="Ana", cpf="11122233311")
            hoje = datetime.now(SP).replace(hour=12, minute=0, second=0, microsecond=0)
            _consulta(pac, d1, hoje)
            _consulta(pac, d2, hoje + timedelta(minutes=45))
            _consulta(pac, d2, hoje + timedelta(minutes=90))

        adm = _cliente(host, "adm@c.com")
        r = adm.get("/api/dashboard/", HTTP_HOST=host)
        assert r.status_code == 200, r.content
        corpo = r.json()
        assert corpo["periodo"] == "semestre"  # default
        assert corpo["financeiro"] is not None and corpo["estoque"] is not None
        assert corpo["atendimento"]["consultas_hoje"]["valor"] == 3  # admin vê todas
        assert isinstance(corpo["financeiro"]["contas_a_receber"]["valor"], str)  # dinheiro como string

        # Período inválido -> 400; sem autenticação -> 401
        assert adm.get("/api/dashboard/?periodo=xyz", HTTP_HOST=host).status_code == 400
        assert APIClient().get("/api/dashboard/", HTTP_HOST=host).status_code == 401

        # Dentista: sem Financeiro (matriz), só as consultas dele; sem cadastro -> zeros (fail-closed)
        d = _cliente(host, "d1@c.com").get("/api/dashboard/", HTTP_HOST=host).json()
        assert d["financeiro"] is None
        assert d["atendimento"]["consultas_hoje"]["valor"] == 1
        sc = _cliente(host, "semcad@c.com").get("/api/dashboard/", HTTP_HOST=host).json()
        assert sc["atendimento"]["consultas_hoje"]["valor"] == 0
        assert sc["atendimento"]["proximas_consultas"] == []

        # Recepção (financeiro FULL na matriz) recebe o bloco financeiro
        rec = _cliente(host, "rec@c.com").get("/api/dashboard/", HTTP_HOST=host).json()
        assert rec["financeiro"] is not None

        # Módulos desabilitados no plano -> 200 com blocos null (não 403)
        clinica.refresh_from_db()
        clinica.override_recursos = {"financeiro": False, "estoque": False}
        clinica.save()
        off = adm.get("/api/dashboard/", HTTP_HOST=host)
        assert off.status_code == 200
        assert off.json()["financeiro"] is None and off.json()["estoque"] is None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_numero_de_queries_do_estoque_nao_cresce_com_insumos(django_assert_max_num_queries):
    """Saldo anotado: 1 insumo ou 30 insumos custam as mesmas queries."""
    from apps.dashboard.services import calcular_estoque, calcular_janelas

    clinica = _criar_clinica("dash_queries", "dashqueries.localhost")
    try:
        with schema_context(clinica.schema_name):
            for i in range(30):
                ins = Insumo.objects.create(nome=f"I{i}", estoque_minimo=Decimal("5"))
                MovimentacaoEstoque.objects.create(insumo=ins, tipo="ENTRADA", quantidade=Decimal("1"))
            with django_assert_max_num_queries(6):
                calcular_estoque(calcular_janelas("mes", date(2026, 10, 7)))
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
