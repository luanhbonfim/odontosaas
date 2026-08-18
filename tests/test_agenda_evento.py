"""Testes do model AgendaEvento (espelho local do evento Google)."""

from datetime import timedelta

import pytest
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.agenda.models import AgendaEvento, Consulta
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
def test_agenda_evento_config():
    assert issubclass(AgendaEvento, ModeloBase)
    # Multi-agenda: 1 evento por (consulta, credencial) -> consulta é FK, não O2O.
    assert AgendaEvento._meta.get_field("consulta").many_to_one is True
    assert AgendaEvento._meta.get_field("credencial").many_to_one is True
    status = {c[0] for c in AgendaEvento._meta.get_field("status_sync").choices}
    assert status == {"PENDENTE", "SINCRONIZADO", "ERRO"}


def test_str():
    assert "Pendente" in str(AgendaEvento())


# --- Criação real dentro do schema de um tenant ---
@pytest.mark.django_db(transaction=True)
def test_criar_agenda_evento():
    clinica = _criar_clinica("evento_tenant", "evento.localhost")
    try:
        with schema_context(clinica.schema_name):
            paciente = Paciente.objects.create(nome_completo="P", cpf="99988877766")
            dentista = Dentista.objects.create(nome_completo="D", cro="CRO-1")
            inicio = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=paciente,
                dentista=dentista,
                inicio=inicio,
                fim=inicio + timedelta(minutes=30),
            )
            evento = AgendaEvento.objects.create(
                consulta=consulta, google_event_id="ev-123", calendar_id="primary"
            )
            assert evento.status_sync == "PENDENTE"
            assert consulta.eventos_google.first() == evento  # related_name (FK)
    finally:
        clinica.delete(force_drop=True)
