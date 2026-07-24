"""Testes da geração automática de contas a receber (signals de Guia/Consulta)."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.financeiro.models import LancamentoFinanceiro
from apps.pacientes.models import Guia, Paciente, PlanoOdontologico
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _paciente(seq=1):
    return Paciente.objects.create(nome_completo="Maria", cpf=f"111222{seq:05d}")


def _guia(valor, status=Guia.Status.EMITIDA, seq=1):
    plano = PlanoOdontologico.objects.create(paciente=_paciente(seq), operadora="Amil")
    return Guia.objects.create(
        plano=plano,
        numero_guia=f"G-{seq}",
        procedimento="Restauração",
        valor=Decimal(valor),
        status=status,
    )


def _consulta(valor, seq=1):
    paciente = Paciente.objects.create(nome_completo="João", cpf=f"999888{seq:05d}")
    dentista = Dentista.objects.create(nome_completo="Dr. X", cro=f"CRO-FIN{seq}")
    inicio = timezone.now() + timedelta(days=1)
    return Consulta.objects.create(
        paciente=paciente,
        dentista=dentista,
        inicio=inicio,
        fim=inicio + timedelta(minutes=30),
        valor=Decimal(valor),
    )


@pytest.mark.django_db(transaction=True)
def test_guia_executada_gera_conta_a_receber():
    clinica = _criar_clinica("fin_guia_tenant", "finguia.localhost")
    try:
        with schema_context(clinica.schema_name):
            guia = _guia("200.00", status=Guia.Status.AUTORIZADA)
            assert not LancamentoFinanceiro.objects.exists()  # ainda não executada

            guia.status = Guia.Status.EXECUTADA
            guia.save(update_fields=["status", "atualizado_em"])

            lanc = LancamentoFinanceiro.objects.get(guia=guia)
            assert lanc.tipo == LancamentoFinanceiro.Tipo.RECEITA
            assert lanc.valor == Decimal("200.00")
            assert lanc.status == LancamentoFinanceiro.Status.PENDENTE

            # idempotente: salvar de novo não duplica
            guia.save(update_fields=["atualizado_em"])
            assert LancamentoFinanceiro.objects.filter(guia=guia).count() == 1
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_guia_sem_valor_ou_nao_executada_nao_gera():
    clinica = _criar_clinica("fin_guia0_tenant", "finguia0.localhost")
    try:
        with schema_context(clinica.schema_name):
            # valor 0 -> não gera mesmo executada
            g0 = _guia("0", status=Guia.Status.EXECUTADA, seq=1)
            g0.save(update_fields=["atualizado_em"])
            assert not LancamentoFinanceiro.objects.filter(guia=g0).exists()

            # com valor, mas ainda AUTORIZADA -> não gera
            g1 = _guia("100", status=Guia.Status.AUTORIZADA, seq=2)
            g1.save(update_fields=["atualizado_em"])
            assert not LancamentoFinanceiro.objects.filter(guia=g1).exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_consulta_realizada_gera_conta_a_receber():
    clinica = _criar_clinica("fin_cons_tenant", "fincons.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta("150.00")
            consulta.status = Consulta.Status.REALIZADA
            consulta.save(update_fields=["status", "atualizado_em"])

            lanc = LancamentoFinanceiro.objects.get(consulta=consulta)
            assert lanc.tipo == LancamentoFinanceiro.Tipo.RECEITA
            assert lanc.valor == Decimal("150.00")

            # idempotente
            consulta.save(update_fields=["atualizado_em"])
            assert LancamentoFinanceiro.objects.filter(consulta=consulta).count() == 1
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_consulta_sem_valor_ou_nao_realizada_nao_gera():
    clinica = _criar_clinica("fin_cons0_tenant", "fincons0.localhost")
    try:
        with schema_context(clinica.schema_name):
            # valor 0, realizada -> não gera
            c0 = _consulta("0", seq=1)
            c0.status = Consulta.Status.REALIZADA
            c0.save(update_fields=["status", "atualizado_em"])
            assert not LancamentoFinanceiro.objects.filter(consulta=c0).exists()

            # com valor, mas apenas EM_ATENDIMENTO -> não gera
            c1 = _consulta("120", seq=2)
            c1.status = Consulta.Status.EM_ATENDIMENTO
            c1.save(update_fields=["status", "atualizado_em"])
            assert not LancamentoFinanceiro.objects.filter(consulta=c1).exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
