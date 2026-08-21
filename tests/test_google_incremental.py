"""Testes da sincronização incremental (Google -> sistema) via syncToken."""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.agenda.models import AgendaEvento, Consulta
from apps.dentistas.models import Dentista
from apps.integracoes.models import CredencialGoogleCalendar
from apps.integracoes.tasks import sincronizar_incremental_todos_tenants
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _consulta_com_evento(google_id, seq=1):
    paciente = Paciente.objects.create(nome_completo="P", cpf=f"3213213{seq:04d}")
    dentista = Dentista.objects.create(nome_completo="D", cro=f"CRO-{seq}")
    inicio = timezone.now() + timedelta(days=1)
    consulta = Consulta.objects.create(
        paciente=paciente, dentista=dentista, inicio=inicio, fim=inicio + timedelta(minutes=30)
    )
    evento = AgendaEvento.objects.create(consulta=consulta, google_event_id=google_id)
    return consulta, evento


def _evento_google(gid, summary, description):
    """Monta um item de evento do Google (criado pela dentista) com horário definido."""
    inicio = timezone.now() + timedelta(days=1)
    fim = inicio + timedelta(minutes=30)
    return {
        "id": gid,
        "status": "confirmed",
        "etag": "eimp",
        "summary": summary,
        "description": description,
        "start": {"dateTime": inicio.isoformat()},
        "end": {"dateTime": fim.isoformat()},
    }


def _rodar_incremental(cred, itens):
    from apps.integracoes.google_calendar import sincronizar_incremental

    service = MagicMock()
    service.events.return_value.list.return_value.execute.return_value = {
        "items": itens,
        "nextSyncToken": "T-IMP",
    }
    with patch("apps.integracoes.google_calendar.build", return_value=service):
        return sincronizar_incremental(cred)


def test_beat_schedule_registrado():
    from apps.plataforma_admin.celery_manager import TAREFAS_PADRAO
    nomes = [t["name"] for t in TAREFAS_PADRAO]
    assert "sincronizar-google-incremental" in nomes


@pytest.mark.django_db(transaction=True)
def test_importa_evento_criado_pela_dentista():
    clinica = _criar_clinica("imp_novo_tenant", "impnovo.localhost")
    try:
        with schema_context(clinica.schema_name):
            dentista = Dentista.objects.create(nome_completo="Dra. Ana", cro="CRO-IMP")
            cred = CredencialGoogleCalendar.objects.create(access_token="tok", dentista=dentista)
            item = _evento_google(
                "g-imp-1", "Joao Teste", "Novo paciente. Contato: (11) 98888-7777"
            )

            _rodar_incremental(cred, [item])

            paciente = Paciente.objects.get(telefone_whatsapp="11988887777")
            assert paciente.nome_completo == "Joao Teste"
            assert paciente.cpf is None  # criado sem CPF
            consulta = Consulta.objects.get(google_event_id="g-imp-1")
            assert consulta.paciente_id == paciente.id
            assert consulta.dentista_id == dentista.id
            assert consulta.status_confirmacao == "PENDENTE"  # entra no fluxo de confirmação
            assert AgendaEvento.objects.filter(google_event_id="g-imp-1").exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_importa_reutiliza_paciente_existente():
    clinica = _criar_clinica("imp_reuso_tenant", "impreuso.localhost")
    try:
        with schema_context(clinica.schema_name):
            dentista = Dentista.objects.create(nome_completo="Dra. Ana", cro="CRO-R")
            cred = CredencialGoogleCalendar.objects.create(access_token="tok", dentista=dentista)
            paciente = Paciente.objects.create(
                nome_completo="Maria", cpf="70070070070", telefone_whatsapp="5511988887777"
            )
            item = _evento_google("g-imp-2", "Maria", "tel (11) 98888-7777")

            _rodar_incremental(cred, [item])

            assert Paciente.objects.count() == 1  # reutilizou, não duplicou
            assert Consulta.objects.get(google_event_id="g-imp-2").paciente_id == paciente.id
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_importa_usa_dentista_fallback():
    clinica = _criar_clinica("imp_fb_tenant", "impfb.localhost")
    try:
        with schema_context(clinica.schema_name):
            dentista = Dentista.objects.create(nome_completo="Unico", cro="CRO-FB")
            cred = CredencialGoogleCalendar.objects.create(access_token="tok")  # sem dentista
            item = _evento_google("g-imp-3", "Paciente X", "whatsapp 11 98888-7777")

            _rodar_incremental(cred, [item])

            assert Consulta.objects.get(google_event_id="g-imp-3").dentista_id == dentista.id
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_nao_importa_eventos_invalidos():
    clinica = _criar_clinica("imp_inval_tenant", "impinval.localhost")
    try:
        with schema_context(clinica.schema_name):
            Dentista.objects.create(nome_completo="D", cro="CRO-IV")
            cred = CredencialGoogleCalendar.objects.create(access_token="tok")
            sem_tel = _evento_google("g-sem-tel", "Sem telefone", "sem contato algum aqui")
            num_invalido = _evento_google("g-num-inv", "X", "pedido 123456789012345678")
            cancelado = {
                "id": "g-cancel-novo",
                "status": "cancelled",
                "start": {"dateTime": timezone.now().isoformat()},
            }

            _rodar_incremental(cred, [sem_tel, num_invalido, cancelado])

            assert not Consulta.objects.filter(
                google_event_id__in=["g-sem-tel", "g-num-inv", "g-cancel-novo"]
            ).exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_nao_importa_sem_dentista():
    clinica = _criar_clinica("imp_sd_tenant", "impsd.localhost")
    try:
        with schema_context(clinica.schema_name):
            cred = CredencialGoogleCalendar.objects.create(access_token="tok")  # sem dentista
            item = _evento_google("g-imp-nd", "Fulano", "tel (11) 98888-7777")  # nenhum dentista

            _rodar_incremental(cred, [item])

            assert not Consulta.objects.filter(google_event_id="g-imp-nd").exists()
            assert not Paciente.objects.filter(telefone_whatsapp="11988887777").exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_sincronizacao_incremental():
    from apps.integracoes.google_calendar import sincronizar_incremental

    clinica = _criar_clinica("incr_tenant", "incr.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta_ok, evento_ok = _consulta_com_evento("ev-normal", seq=1)
            consulta_cancel, evento_cancel = _consulta_com_evento("ev-cancelado", seq=2)
            cred = CredencialGoogleCalendar.objects.create(access_token="tok")

            service = MagicMock()
            service.events.return_value.list.return_value.execute.return_value = {
                "items": [
                    {"id": "ev-normal", "etag": "e1", "status": "confirmed"},
                    {"id": "ev-cancelado", "etag": "e2", "status": "cancelled"},
                    {"id": "desconhecido", "status": "confirmed"},  # sem AgendaEvento local
                ],
                "nextSyncToken": "TOKEN-XYZ",
            }

            with patch("apps.integracoes.google_calendar.build", return_value=service):
                qtd = sincronizar_incremental(cred)

            assert qtd == 3
            cred.refresh_from_db()
            assert cred.sync_token == "TOKEN-XYZ"

            evento_ok.refresh_from_db()
            assert evento_ok.status_sync == "SINCRONIZADO"
            assert evento_ok.ultima_sincronizacao is not None

            # Evento cancelado no Google -> consulta cancelada localmente
            consulta_cancel.refresh_from_db()
            assert consulta_cancel.status == "CANCELADA"

            # 2ª sincronização usa o syncToken salvo (envia syncToken ao list)
            with patch("apps.integracoes.google_calendar.build", return_value=service):
                sincronizar_incremental(cred)
            service.events.return_value.list.assert_called_with(
                calendarId=cred.calendar_id, syncToken="TOKEN-XYZ"
            )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_task_beat_varre_tenants():
    clinica = _criar_clinica("incr_beat_tenant", "incrbeat.localhost")
    try:
        with schema_context(clinica.schema_name):
            _consulta_com_evento("ev-beat")
            CredencialGoogleCalendar.objects.create(access_token="tok")

        service = MagicMock()
        service.events.return_value.list.return_value.execute.return_value = {
            "items": [{"id": "ev-beat", "etag": "e", "status": "confirmed"}],
            "nextSyncToken": "T1",
        }
        with patch("apps.integracoes.google_calendar.build", return_value=service):
            sincronizar_incremental_todos_tenants()

        with schema_context(clinica.schema_name):
            evento = AgendaEvento.objects.get(google_event_id="ev-beat")
            assert evento.status_sync == "SINCRONIZADO"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
