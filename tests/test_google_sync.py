"""Testes da sincronização de consulta com o Google Calendar (mock da API)."""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.agenda.models import AgendaEvento, Consulta
from apps.dentistas.models import Dentista
from apps.integracoes.models import CredencialGoogleCalendar
from apps.integracoes.tasks import sincronizar_evento_google
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _consulta(dentista_cred=True):
    """Cria paciente/dentista/consulta e uma credencial (por dentista ou clínica)."""
    paciente = Paciente.objects.create(nome_completo="P", cpf="12312312312")
    dentista = Dentista.objects.create(nome_completo="D", cro="CRO-1")
    inicio = timezone.now() + timedelta(days=1)
    consulta = Consulta.objects.create(
        paciente=paciente, dentista=dentista, inicio=inicio, fim=inicio + timedelta(minutes=30)
    )
    CredencialGoogleCalendar.objects.create(
        dentista=dentista if dentista_cred else None,
        access_token="tok",
        refresh_token="ref",
        scope="https://www.googleapis.com/auth/calendar.events",
    )
    return consulta


def _mock_service(event_id="gid-1", etag="etag-1"):
    service = MagicMock()
    events = service.events.return_value
    events.insert.return_value.execute.return_value = {"id": event_id, "etag": etag}
    events.update.return_value.execute.return_value = {"id": event_id, "etag": "etag-upd"}
    return service, events


@pytest.mark.django_db(transaction=True)
def test_sincronizar_insert_e_update():
    clinica = _criar_clinica("sync_tenant", "sync.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.integracoes.google_calendar import sincronizar_consulta

            consulta = _consulta(dentista_cred=True)  # credencial do dentista
            service, events = _mock_service()

            with patch("apps.integracoes.google_calendar.build", return_value=service):
                # 1ª sync: INSERT
                evento = sincronizar_consulta(consulta)
                assert events.insert.called
                assert evento.google_event_id == "gid-1"
                assert evento.status_sync == "SINCRONIZADO"
                consulta.refresh_from_db()
                assert consulta.google_event_id == "gid-1"

                # 2ª sync: UPDATE (já tem google_event_id)
                evento = sincronizar_consulta(consulta)
                assert events.update.called
                assert evento.etag == "etag-upd"
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_sincronizar_sem_credencial_marca_erro():
    clinica = _criar_clinica("sync_erro_tenant", "syncerro.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.integracoes.google_calendar import sincronizar_consulta

            paciente = Paciente.objects.create(nome_completo="P", cpf="45645645645")
            dentista = Dentista.objects.create(nome_completo="D", cro="CRO-2")
            inicio = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=paciente,
                dentista=dentista,
                inicio=inicio,
                fim=inicio + timedelta(minutes=30),
            )
            evento = sincronizar_consulta(consulta)
            assert evento.status_sync == "ERRO"
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_event_body_confirmada_fica_verde_e_tem_telefone():
    clinica = _criar_clinica("sync_body_tenant", "syncbody.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.integracoes.google_calendar import COR_CONFIRMADA, _event_body

            paciente = Paciente.objects.create(
                nome_completo="Maria", cpf="99988877766", telefone_whatsapp="5511988887777"
            )
            dentista = Dentista.objects.create(nome_completo="Dra. Ana", cro="CRO-9")
            inicio = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=paciente,
                dentista=dentista,
                inicio=inicio,
                fim=inicio + timedelta(minutes=30),
            )

            # Pendente -> sem cor especial, mas com o telefone FORMATADO na descrição.
            body = _event_body(consulta)
            assert "colorId" not in body
            assert "Telefone: (11) 98888-7777" in body["description"]

            # Confirmada -> evento verde.
            consulta.status_confirmacao = Consulta.StatusConfirmacao.CONFIRMADA
            assert _event_body(consulta)["colorId"] == COR_CONFIRMADA
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_task_sincronizar_evento_google():
    clinica = _criar_clinica("sync_task_tenant", "synctask.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _consulta(dentista_cred=False)  # credencial da clínica (fallback)
            cid = consulta.id

        service, _ = _mock_service(event_id="gid-9")
        with patch("apps.integracoes.google_calendar.build", return_value=service):
            gid = sincronizar_evento_google(clinica.schema_name, cid)
        assert gid == "gid-9"

        with schema_context(clinica.schema_name):
            evento = AgendaEvento.objects.get(consulta_id=cid)
            assert evento.status_sync == "SINCRONIZADO"
            assert evento.google_event_id == "gid-9"
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
