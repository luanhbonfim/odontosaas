"""Testes do app dentistas (Dentista, Especialidade)."""

import pytest
from django_tenants.utils import schema_context

from apps.core.models import ModeloBase
from apps.dentistas.models import Dentista, Especialidade
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_dentistas_no_tenant_apps(settings):
    assert "apps.dentistas" in settings.TENANT_APPS


def test_modelos_herdam_modelo_base():
    assert issubclass(Dentista, ModeloBase)
    assert issubclass(Especialidade, ModeloBase)


def test_dentista_campos():
    assert Dentista._meta.get_field("cro").unique is True
    assert Dentista._meta.get_field("especialidades").many_to_many is True
    assert Dentista._meta.get_field("usuario").one_to_one is True


def test_str():
    assert str(Especialidade(nome="Ortodontia")) == "Ortodontia"
    assert str(Dentista(nome_completo="Dra. Ana", cro="12345")) == "Dra. Ana (CRO 12345)"


# --- Criação real dentro do schema de um tenant ---
@pytest.mark.django_db(transaction=True)
def test_criar_dentista_com_especialidades():
    clinica = _criar_clinica("dentistas_tenant", "dentistas.localhost")
    try:
        with schema_context(clinica.schema_name):
            orto = Especialidade.objects.create(nome="Ortodontia")
            endo = Especialidade.objects.create(nome="Endodontia")
            dentista = Dentista.objects.create(nome_completo="Dra. Ana Souza", cro="CRO-SP-12345")
            dentista.especialidades.add(orto, endo)

            assert Dentista.objects.count() == 1
            assert dentista.especialidades.count() == 2
            assert orto.dentistas.first() == dentista
    finally:
        clinica.delete(force_drop=True)
