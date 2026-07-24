"""Testes do app pacientes (model Paciente)."""

import pytest
from django_tenants.utils import schema_context

from apps.core.models import ModeloBase
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_pacientes_no_tenant_apps(settings):
    assert "apps.pacientes" in settings.TENANT_APPS


@pytest.mark.parametrize(
    ("bruto", "esperado"),
    [
        ("5518997999509", "(18) 99799-9509"),  # código do país (55) + celular
        ("18997999509", "(18) 99799-9509"),  # sem código do país + celular
        ("1833334444", "(18) 3333-4444"),  # fixo (8 dígitos)
        ("+55 (11) 98888-7777", "(11) 98888-7777"),  # já com pontuação
        ("55988887777", "(55) 98888-7777"),  # DDD 55 sem país (não remove)
        ("", ""),  # vazio -> devolve original
        ("12345", "12345"),  # formato inesperado -> devolve original
    ],
)
def test_telefone_formatado(bruto, esperado):
    assert Paciente(telefone_whatsapp=bruto).telefone_formatado == esperado


def test_paciente_herda_modelo_base_e_cpf_unico():
    assert issubclass(Paciente, ModeloBase)
    assert Paciente._meta.get_field("cpf").unique is True


def test_str():
    assert str(Paciente(nome_completo="João da Silva")) == "João da Silva"


# --- Criação real dentro do schema de um tenant ---
@pytest.mark.django_db(transaction=True)
def test_criar_paciente():
    clinica = _criar_clinica("pacientes_tenant", "pacientes.localhost")
    try:
        with schema_context(clinica.schema_name):
            paciente = Paciente.objects.create(
                nome_completo="Maria Souza",
                cpf="12345678901",
                telefone_whatsapp="11988887777",
            )
            assert Paciente.objects.count() == 1
            assert paciente.ativo is True  # herdado de ModeloBase
    finally:
        clinica.delete(force_drop=True)
