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
def test_cancelar_consulta_devolve_estoque():
    clinica = _criar_clinica("bx_cancel_tenant", "bxcancel.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            insumo = _insumo_com_saldo("Luva", "10")
            ConsumoInsumo.objects.create(consulta=consulta, insumo=insumo, quantidade=Decimal("3"))

            _realizar(consulta)
            assert insumo.calcular_saldo() == Decimal("7")  # 10 - 3

            # Cancelar devolve os insumos (remove as SAÍDAs) -> saldo volta a 10
            consulta.status = Consulta.Status.CANCELADA
            consulta.save(update_fields=["status", "atualizado_em"])
            assert insumo.calcular_saldo() == Decimal("10")
            assert not MovimentacaoEstoque.objects.filter(
                consulta=consulta, tipo=MovimentacaoEstoque.Tipo.SAIDA
            ).exists()
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


@pytest.mark.django_db(transaction=True)
def test_consumo_adicionado_apos_realizar_baixa_estoque():
    """E6: consumo criado depois da baixa (consulta já REALIZADA) gera a SAÍDA."""
    clinica = _criar_clinica("e6_tenant", "e6.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            insumo = _insumo_com_saldo("Luva", "10")
            ConsumoInsumo.objects.create(consulta=consulta, insumo=insumo, quantidade=Decimal("2"))
            _realizar(consulta)
            assert insumo.calcular_saldo() == Decimal("8")

            # Novo consumo com a consulta já realizada -> baixa na hora.
            ConsumoInsumo.objects.create(consulta=consulta, insumo=insumo, quantidade=Decimal("3"))
            assert insumo.calcular_saldo() == Decimal("5")  # 8 - 3
            assert (
                MovimentacaoEstoque.objects.filter(
                    consulta=consulta, tipo=MovimentacaoEstoque.Tipo.SAIDA
                ).count()
                == 2
            )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_editar_consumo_ajusta_saida():
    """E4: editar a quantidade de um consumo ajusta a SAÍDA (sem duplicar)."""
    clinica = _criar_clinica("e4_tenant", "e4.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            insumo = _insumo_com_saldo("Gaze", "10")
            consumo = ConsumoInsumo.objects.create(
                consulta=consulta, insumo=insumo, quantidade=Decimal("2")
            )
            _realizar(consulta)
            assert insumo.calcular_saldo() == Decimal("8")

            consumo.quantidade = Decimal("5")
            consumo.save(update_fields=["quantidade", "atualizado_em"])
            assert insumo.calcular_saldo() == Decimal("5")  # 10 - 5
            assert (
                MovimentacaoEstoque.objects.filter(
                    consumo=consumo, tipo=MovimentacaoEstoque.Tipo.SAIDA
                ).count()
                == 1
            )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_excluir_consumo_devolve_estoque():
    """E5: excluir um consumo remove a SAÍDA correspondente (devolve ao estoque)."""
    clinica = _criar_clinica("e5_tenant", "e5.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            insumo = _insumo_com_saldo("Agulha", "10")
            consumo = ConsumoInsumo.objects.create(
                consulta=consulta, insumo=insumo, quantidade=Decimal("4")
            )
            _realizar(consulta)
            assert insumo.calcular_saldo() == Decimal("6")

            consumo.delete()
            assert insumo.calcular_saldo() == Decimal("10")  # devolvido
            assert not MovimentacaoEstoque.objects.filter(
                tipo=MovimentacaoEstoque.Tipo.SAIDA
            ).exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_quantidade_positiva_imposta_pelo_banco():
    """E7: CheckConstraint impede quantidade <= 0 no nível do banco."""
    from django.db import IntegrityError, transaction

    clinica = _criar_clinica("e7_tenant", "e7.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            insumo = _insumo_com_saldo("Luva", "10")

            with pytest.raises(IntegrityError), transaction.atomic():
                ConsumoInsumo.objects.create(
                    consulta=consulta, insumo=insumo, quantidade=Decimal("0")
                )

            with pytest.raises(IntegrityError), transaction.atomic():
                MovimentacaoEstoque.objects.create(
                    insumo=insumo,
                    tipo=MovimentacaoEstoque.Tipo.SAIDA,
                    quantidade=Decimal("-1"),
                )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_estornar_consulta_realizada_reverte_estoque_e_financeiro():
    """Action `estornar`: consulta REALIZADA lançada por engano volta a CANCELADA,
    devolvendo o estoque e cancelando a conta a receber."""
    from decimal import Decimal as D

    from rest_framework.test import APIClient

    from apps.financeiro.models import LancamentoFinanceiro

    host = "estornac.localhost"
    clinica = _criar_clinica("estornac_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            consulta.valor = D("120")
            consulta.save(update_fields=["valor", "atualizado_em"])
            insumo = _insumo_com_saldo("Luva", "10")
            ConsumoInsumo.objects.create(consulta=consulta, insumo=insumo, quantidade=D("3"))
            _realizar(consulta)  # gera a conta e a baixa
            cid = consulta.id
            assert insumo.calcular_saldo() == D("7")
            assert LancamentoFinanceiro.objects.get(consulta_id=cid).status == "PENDENTE"

        resp = client.post(f"/api/consultas/{cid}/estornar/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert resp.json()["status"] == "CANCELADA"

        with schema_context(clinica.schema_name):
            assert insumo.calcular_saldo() == D("10")  # estoque devolvido
            assert LancamentoFinanceiro.objects.get(consulta_id=cid).status == "CANCELADO"

        # estornar de novo (não está mais realizada) -> 400
        assert client.post(f"/api/consultas/{cid}/estornar/", HTTP_HOST=host).status_code == 400
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_excluir_consulta_realizada_devolve_estoque():
    """Excluir a consulta (cascade nos consumos) remove as SAÍDAs — sem órfã por SET_NULL."""
    clinica = _criar_clinica("bx_delc_tenant", "bxdelc.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta()
            insumo = _insumo_com_saldo("Luva", "10")
            ConsumoInsumo.objects.create(consulta=consulta, insumo=insumo, quantidade=Decimal("3"))
            _realizar(consulta)
            assert insumo.calcular_saldo() == Decimal("7")

            consulta.delete()
            assert insumo.calcular_saldo() == Decimal("10")  # SAÍDAs removidas
            assert not MovimentacaoEstoque.objects.filter(
                tipo=MovimentacaoEstoque.Tipo.SAIDA
            ).exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
