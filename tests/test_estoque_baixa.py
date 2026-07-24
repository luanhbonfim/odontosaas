"""Testes da baixa automática de estoque ao realizar a consulta (signal)."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.estoque.models import ConsumoInsumo, Insumo, MovimentacaoEstoque
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _consulta():
    paciente = Paciente.objects.create(nome_completo="P", cpf="11122233344")
    dentista = Dentista.objects.create(nome_completo="D", cro="CRO-BX")
    inicio = timezone.now() + timedelta(days=1)
    return Consulta.objects.create(
        paciente=paciente, dentista=dentista, inicio=inicio, fim=inicio + timedelta(minutes=30)
    )


def _insumo_com_saldo(nome, entrada):
    insumo = Insumo.objects.create(nome=nome)
    MovimentacaoEstoque.objects.create(
        insumo=insumo, tipo=MovimentacaoEstoque.Tipo.ENTRADA, quantidade=Decimal(entrada)
    )
    return insumo


def _realizar(consulta):
    consulta.status = Consulta.Status.REALIZADA
    consulta.save(update_fields=["status", "atualizado_em"])


@pytest.mark.django_db(transaction=True)
def test_baixa_automatica_ao_realizar():
    clinica = _criar_clinica("bx_ok_tenant", "bxok.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            insumo = _insumo_com_saldo("Luva", "10")
            consumo = ConsumoInsumo.objects.create(
                consulta=consulta, insumo=insumo, quantidade=Decimal("2")
            )
            assert str(consumo).startswith("2")  # __str__
            assert insumo.calcular_saldo() == Decimal("10")

            _realizar(consulta)  # dispara o signal

            assert insumo.calcular_saldo() == Decimal("8")  # 10 - 2
            saida = MovimentacaoEstoque.objects.get(
                consulta=consulta, tipo=MovimentacaoEstoque.Tipo.SAIDA
            )
            assert saida.quantidade == Decimal("2")
            assert saida.insumo_id == insumo.id
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_baixa_e_idempotente():
    clinica = _criar_clinica("bx_idem_tenant", "bxidem.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            insumo = _insumo_com_saldo("Gaze", "10")
            ConsumoInsumo.objects.create(consulta=consulta, insumo=insumo, quantidade=Decimal("3"))

            _realizar(consulta)
            # salvar de novo (ainda REALIZADA) não deve gerar nova baixa
            consulta.save(update_fields=["atualizado_em"])

            assert (
                MovimentacaoEstoque.objects.filter(
                    consulta=consulta, tipo=MovimentacaoEstoque.Tipo.SAIDA
                ).count()
                == 1
            )
            assert insumo.calcular_saldo() == Decimal("7")  # baixa aplicada só 1x
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_sem_baixa_se_nao_realizada():
    clinica = _criar_clinica("bx_naorel_tenant", "bxnaorel.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            insumo = _insumo_com_saldo("Agulha", "10")
            ConsumoInsumo.objects.create(consulta=consulta, insumo=insumo, quantidade=Decimal("2"))

            # iniciar (EM_ATENDIMENTO) não dispara baixa
            consulta.status = Consulta.Status.EM_ATENDIMENTO
            consulta.save(update_fields=["status", "atualizado_em"])

            assert not MovimentacaoEstoque.objects.filter(
                tipo=MovimentacaoEstoque.Tipo.SAIDA
            ).exists()
            assert insumo.calcular_saldo() == Decimal("10")
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_realizar_sem_consumos_nao_gera_saida():
    clinica = _criar_clinica("bx_semcons_tenant", "bxsemcons.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            _realizar(consulta)  # nenhum ConsumoInsumo cadastrado
            assert not MovimentacaoEstoque.objects.filter(
                tipo=MovimentacaoEstoque.Tipo.SAIDA
            ).exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
