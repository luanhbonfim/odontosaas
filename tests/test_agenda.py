"""Testes do app agenda (model Consulta)."""

from datetime import timedelta

import pytest
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.agenda.models import Consulta
from apps.core.models import ModeloBase
from apps.dentistas.models import Dentista
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_agenda_no_tenant_apps(settings):
    assert "apps.agenda" in settings.TENANT_APPS


def test_consulta_config():
    assert issubclass(Consulta, ModeloBase)
    status = {c[0] for c in Consulta._meta.get_field("status").choices}
    assert status == {"AGENDADA", "EM_ATENDIMENTO", "REALIZADA", "CANCELADA", "FALTOU"}
    conf = {c[0] for c in Consulta._meta.get_field("status_confirmacao").choices}
    assert conf == {"PENDENTE", "CONFIRMADA", "RECUSADA", "SEM_RESPOSTA"}


# --- Criação real dentro do schema de um tenant ---
@pytest.mark.django_db(transaction=True)
def test_criar_consulta():
    clinica = _criar_clinica("agenda_tenant", "agenda.localhost")
    try:
        with schema_context(clinica.schema_name):
            paciente = Paciente.objects.create(nome_completo="João", cpf="11122233344")
            dentista = Dentista.objects.create(nome_completo="Dra. Ana", cro="CRO-1")
            inicio = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=paciente,
                dentista=dentista,
                inicio=inicio,
                fim=inicio + timedelta(minutes=30),
            )
            assert consulta.status == "AGENDADA"
            assert consulta.status_confirmacao == "PENDENTE"
            assert consulta.google_event_id == ""
            assert paciente.nome_completo in str(consulta)
    finally:
        clinica.delete(force_drop=True)
