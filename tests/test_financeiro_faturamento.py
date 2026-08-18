"""Testes do faturamento por operadora (agrupa contas a receber de guias em Fatura)."""

from decimal import Decimal

import pytest
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.financeiro.models import LancamentoFinanceiro
from apps.financeiro.services import faturar_operadora
from apps.pacientes.models import Guia, Paciente, PlanoOdontologico
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _guia_executada(operadora, valor, seq):
    """Cria guia executada -> o signal gera a conta a receber correspondente."""
    paciente = Paciente.objects.create(nome_completo="P", cpf=f"222333{seq:05d}")
    plano = PlanoOdontologico.objects.create(paciente=paciente, operadora=operadora)
    guia = Guia.objects.create(
        plano=plano,
        numero_guia=f"G{seq}",
        procedimento="Proc",
        valor=Decimal(valor),
        status=Guia.Status.AUTORIZADA,
    )
    guia.status = Guia.Status.EXECUTADA
    guia.save(update_fields=["status", "atualizado_em"])
    return guia


@pytest.mark.django_db(transaction=True)
def test_faturar_operadora_agrupa_contas():
    clinica = _criar_clinica("fat_tenant", "fat.localhost")
    try:
        with schema_context(clinica.schema_name):
            _guia_executada("Amil", "100", 1)
            _guia_executada("Amil", "150", 2)
            _guia_executada("Uniodonto", "80", 3)

            fatura = faturar_operadora("Amil", "07/2026")
            assert fatura.operadora == "Amil"
            assert fatura.competencia == "07/2026"
            assert fatura.valor_total == Decimal("250.00")  # 100 + 150
            assert fatura.lancamentos.count() == 2

            # A conta da Uniodonto continua sem fatura
            assert (
                LancamentoFinanceiro.objects.filter(
                    tipo=LancamentoFinanceiro.Tipo.RECEITA, fatura__isnull=True
                ).count()
                == 1
            )

            # Re-faturar a mesma operadora -> nada pendente
            assert faturar_operadora("Amil") is None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_glosa_estorna_conta_a_receber():
    clinica = _criar_clinica("estorno_tenant", "estorno.localhost")
    try:
        with schema_context(clinica.schema_name):
            # Guia executada gera a conta PENDENTE (com vencimento — N13)
            guia = _guia_executada("Amil", "200", 9)
            conta = LancamentoFinanceiro.objects.get(guia=guia)
            assert conta.status == LancamentoFinanceiro.Status.PENDENTE
            assert conta.vencimento is not None

            # GLOSADA -> estorna (cancela) a conta pendente
            guia.status = Guia.Status.GLOSADA
            guia.save(update_fields=["status", "atualizado_em"])
            conta.refresh_from_db()
            assert conta.status == LancamentoFinanceiro.Status.CANCELADO
            # faturar não varre a cancelada
            assert faturar_operadora("Amil") is None

            # Conta já PAGA NÃO é estornada pela glosa (reconciliação manual)
            guia2 = _guia_executada("Bradesco", "300", 10)
            conta2 = LancamentoFinanceiro.objects.get(guia=guia2)
            conta2.status = LancamentoFinanceiro.Status.PAGO
            conta2.save(update_fields=["status"])
            guia2.status = Guia.Status.GLOSADA
            guia2.save(update_fields=["status", "atualizado_em"])
            conta2.refresh_from_db()
            assert conta2.status == LancamentoFinanceiro.Status.PAGO
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_cancelar_consulta_estorna_conta():
    from datetime import timedelta

    from django.utils import timezone

    from apps.agenda.models import Consulta
    from apps.dentistas.models import Dentista

    clinica = _criar_clinica("estornoc_tenant", "estornoc.localhost")
    try:
        with schema_context(clinica.schema_name):
            pac = Paciente.objects.create(nome_completo="P", cpf="99988800011")
            den = Dentista.objects.create(nome_completo="D", cro="EST-C1")
            ini = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=pac,
                dentista=den,
                inicio=ini,
                fim=ini + timedelta(minutes=30),
                valor=Decimal("120"),
            )
            consulta.status = Consulta.Status.REALIZADA
            consulta.save(update_fields=["status", "atualizado_em"])
            conta = LancamentoFinanceiro.objects.get(consulta=consulta)
            assert conta.status == LancamentoFinanceiro.Status.PENDENTE

            consulta.status = Consulta.Status.CANCELADA
            consulta.save(update_fields=["status", "atualizado_em"])
            conta.refresh_from_db()
            assert conta.status == LancamentoFinanceiro.Status.CANCELADO
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_endpoint_faturar():
    host = "apifat.localhost"
    clinica = _criar_clinica("api_fat", host)
    client = APIClient()
    try:
        with schema_context("api_fat"):
            _guia_executada("Amil", "100", 1)
            _guia_executada("Amil", "150", 2)

        # faturar via endpoint
        resp = client.post(
            "/api/faturas/faturar/",
            {"operadora": "Amil", "competencia": "07/2026"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        assert resp.json()["valor_total"] == "250.00"
        assert resp.json()["quantidade_lancamentos"] == 2

        # sem operadora -> 400
        assert (
            client.post("/api/faturas/faturar/", {}, format="json", HTTP_HOST=host).status_code
            == 400
        )
        # operadora sem contas pendentes -> 400
        resp = client.post(
            "/api/faturas/faturar/", {"operadora": "Inexistente"}, format="json", HTTP_HOST=host
        )
        assert resp.status_code == 400

        # a fatura aparece na listagem
        assert len(client.get("/api/faturas/", HTTP_HOST=host).json()) == 1
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_editar_valor_da_guia_sincroniza_conta():
    """F3: editar o valor de uma guia executada atualiza a conta a receber pendente."""
    clinica = _criar_clinica("f3_tenant", "f3.localhost")
    try:
        with schema_context(clinica.schema_name):
            guia = _guia_executada("Amil", "100", 20)
            conta = LancamentoFinanceiro.objects.get(guia=guia)
            assert conta.valor == Decimal("100")

            guia.valor = Decimal("175")
            guia.save(update_fields=["valor", "atualizado_em"])
            conta.refresh_from_db()
            assert conta.valor == Decimal("175")

            # conta já paga NÃO é alterada por edição posterior do valor
            conta.status = LancamentoFinanceiro.Status.PAGO
            conta.save(update_fields=["status"])
            guia.valor = Decimal("999")
            guia.save(update_fields=["valor", "atualizado_em"])
            conta.refresh_from_db()
            assert conta.valor == Decimal("175")
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_excluir_guia_cancela_conta_pendente():
    """F2: excluir a guia cancela a conta pendente (senão fica órfã e ainda contada)."""
    clinica = _criar_clinica("f2_tenant", "f2.localhost")
    try:
        with schema_context(clinica.schema_name):
            guia = _guia_executada("Amil", "100", 30)
            conta = LancamentoFinanceiro.objects.get(guia=guia)
            assert conta.status == LancamentoFinanceiro.Status.PENDENTE

            guia.delete()
            conta.refresh_from_db()
            assert conta.status == LancamentoFinanceiro.Status.CANCELADO
            assert conta.guia_id is None  # FK SET_NULL após o estorno
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_glosa_apos_faturar_recalcula_total_da_fatura():
    """F6: glosar uma guia já faturada reduz o valor_total da fatura."""
    clinica = _criar_clinica("f6_tenant", "f6.localhost")
    try:
        with schema_context(clinica.schema_name):
            g1 = _guia_executada("Amil", "100", 40)
            _guia_executada("Amil", "150", 41)
            fatura = faturar_operadora("Amil")
            assert fatura.valor_total == Decimal("250.00")

            g1.status = Guia.Status.GLOSADA
            g1.save(update_fields=["status", "atualizado_em"])
            fatura.refresh_from_db()
            assert fatura.valor_total == Decimal("150.00")
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_quitar_e_estornar_lancamento():
    """Ação quitar (PAGO) e o seu inverso estornar (volta a PENDENTE)."""
    host = "apiest.localhost"
    clinica = _criar_clinica("api_est", host)
    client = APIClient()
    try:
        with schema_context("api_est"):
            guia = _guia_executada("Amil", "100", 50)
            cid = LancamentoFinanceiro.objects.get(guia=guia).id

        resp = client.post(f"/api/lancamentos/{cid}/quitar/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert resp.json()["status"] == "PAGO"

        resp = client.post(f"/api/lancamentos/{cid}/estornar/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert resp.json()["status"] == "PENDENTE"

        with schema_context("api_est"):
            assert LancamentoFinanceiro.objects.get(id=cid).pago_em is None

        # estornar de novo (não está pago) -> 400
        resp = client.post(f"/api/lancamentos/{cid}/estornar/", HTTP_HOST=host)
        assert resp.status_code == 400
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_consulta_por_convenio_nao_gera_conta_particular():
    """Financeiro por origem: consulta por convênio é faturada via Guia (sem conta
    particular); consulta particular gera a conta pelo valor."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.agenda.models import Consulta
    from apps.convenios.models import Convenio
    from apps.dentistas.models import Dentista

    clinica = _criar_clinica("convconta_tenant", "convconta.localhost")
    try:
        with schema_context(clinica.schema_name):
            pac = Paciente.objects.create(nome_completo="P", cpf="88877766655")
            den = Dentista.objects.create(nome_completo="D", cro="CV-1")
            conv = Convenio.objects.create(nome="Amil")
            ini = timezone.now() + timedelta(days=1)

            # Por convênio (com valor) -> REALIZADA NÃO gera conta particular.
            c_conv = Consulta.objects.create(
                paciente=pac,
                dentista=den,
                inicio=ini,
                fim=ini + timedelta(minutes=30),
                valor=Decimal("100"),
                convenio=conv,
            )
            c_conv.status = Consulta.Status.REALIZADA
            c_conv.save(update_fields=["status", "atualizado_em"])
            assert not LancamentoFinanceiro.objects.filter(consulta=c_conv).exists()

            # Particular -> gera a conta pelo valor.
            c_part = Consulta.objects.create(
                paciente=pac,
                dentista=den,
                inicio=ini + timedelta(hours=2),
                fim=ini + timedelta(hours=2, minutes=30),
                valor=Decimal("120"),
            )
            c_part.status = Consulta.Status.REALIZADA
            c_part.save(update_fields=["status", "atualizado_em"])
            assert LancamentoFinanceiro.objects.get(consulta=c_part).valor == Decimal("120")
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_nao_quita_lancamento_cancelado():
    """Guarda: uma conta CANCELADA (ex.: glosa) não pode ser quitada."""
    host = "apiqc.localhost"
    clinica = _criar_clinica("api_qc", host)
    client = APIClient()
    try:
        with schema_context("api_qc"):
            guia = _guia_executada("Amil", "100", 51)
            cid = LancamentoFinanceiro.objects.get(guia=guia).id
            guia.status = Guia.Status.GLOSADA
            guia.save(update_fields=["status", "atualizado_em"])
            assert (
                LancamentoFinanceiro.objects.get(id=cid).status
                == LancamentoFinanceiro.Status.CANCELADO
            )

        assert client.post(f"/api/lancamentos/{cid}/quitar/", HTTP_HOST=host).status_code == 400
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
