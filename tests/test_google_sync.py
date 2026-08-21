"""Testes da sincronização de consulta com o Google Calendar (mock da API)."""

from datetime import timedelta
from unittest.mock import MagicMock, patch

import pytest
from django.utils import timezone
from django_tenants.utils import schema_context
from googleapiclient.errors import HttpError

from apps.agenda.models import AgendaEvento, Consulta
from apps.dentistas.models import Dentista
from apps.integracoes.models import CredencialGoogleCalendar
from apps.integracoes.tasks import remover_evento_google, sincronizar_evento_google
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
def test_evento_importado_nunca_e_tocado():
    """Blindagem: evento IMPORTADO (manual da clínica) nunca é atualizado nem
    removido do Google — nem quando a consulta sai de escopo (cancelada)."""
    clinica = _criar_clinica("imp_tenant", "imp.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.integracoes.google_calendar import (
                reconciliar_google,
                sincronizar_consulta,
            )

            consulta = _consulta(dentista_cred=False)  # credencial da clínica (vê todas)
            cred = CredencialGoogleCalendar.objects.filter(dentista__isnull=True).first()
            AgendaEvento.objects.create(
                consulta=consulta,
                credencial=cred,
                google_event_id="manual-1",
                calendar_id="primary",
                origem=AgendaEvento.Origem.IMPORTADO,
            )
            service, events = _mock_service()
            with patch("apps.integracoes.google_calendar.build", return_value=service):
                # (1) não atualiza/insere um evento importado
                sincronizar_consulta(consulta, cred)
                assert not events.update.called
                assert not events.insert.called

                # (2) consulta fora de escopo (cancelada) NÃO apaga o evento manual
                consulta.status = Consulta.Status.CANCELADA
                consulta.save(update_fields=["status"])
                reconciliar_google(aplicar_cancelamento=False)
                assert not events.delete.called
                assert AgendaEvento.objects.filter(google_event_id="manual-1").exists()
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


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
def test_reconciliar_escopo_e_nao_confirmada():
    """Reconciliação: clínica vê todas; dentista só as suas; pendente dentro do
    prazo vira CANCELADA e sai do Google."""
    from apps.integracoes.google_calendar import reconciliar_google
    from apps.notificacoes.models import ConfiguracaoNotificacao

    clinica = _criar_clinica("recon_tenant", "recon.localhost")
    try:
        with schema_context(clinica.schema_name):
            ConfiguracaoNotificacao.objects.create(
                ativo=True, cancelar_nao_confirmadas=True, cancelar_horas_antes=24
            )
            pac = Paciente.objects.create(nome_completo="P", cpf="12312312312")
            dent_a = Dentista.objects.create(nome_completo="A", cro="CRO-A")
            dent_b = Dentista.objects.create(nome_completo="B", cro="CRO-B")
            for alvo in (None, dent_a):  # credenciais: clínica + dentista A
                CredencialGoogleCalendar.objects.create(
                    dentista=alvo, access_token="t", refresh_token="r", scope="s"
                )
            longe = timezone.now() + timedelta(days=3)
            c1 = Consulta.objects.create(
                paciente=pac,
                dentista=dent_a,
                inicio=longe,
                fim=longe + timedelta(minutes=30),
                status_confirmacao="CONFIRMADA",
            )
            c2 = Consulta.objects.create(
                paciente=pac,
                dentista=dent_b,
                inicio=longe + timedelta(hours=1),
                fim=longe + timedelta(hours=1, minutes=30),
                status_confirmacao="CONFIRMADA",
            )
            perto = timezone.now() + timedelta(hours=2)  # pendente dentro de 24h
            c3 = Consulta.objects.create(
                paciente=pac, dentista=dent_a, inicio=perto, fim=perto + timedelta(minutes=30)
            )

            service, _ = _mock_service()
            with patch("apps.integracoes.google_calendar.build", return_value=service):
                resumo = reconciliar_google()

            c3.refresh_from_db()
            assert c3.status == "CANCELADA"  # não confirmada -> cancelada
            assert resumo["canceladas"] == 1
            # c1 (dentista A) vai para a agenda da clínica E a do dentista A.
            assert AgendaEvento.objects.filter(consulta=c1, credencial__dentista=None).exists()
            assert AgendaEvento.objects.filter(consulta=c1, credencial__dentista=dent_a).exists()
            # c2 (dentista B, sem credencial) vai só para a clínica.
            assert AgendaEvento.objects.filter(consulta=c2, credencial__dentista=None).exists()
            assert not AgendaEvento.objects.filter(consulta=c2, credencial__dentista=dent_a).exists()
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_excluir_consulta_enfileira_remocao_e_reconcilia_apaga():
    """Excluir a consulta cria um tombstone; a reconciliação apaga do Google."""
    from apps.agenda.models import EventoGoogleRemovido

    clinica = _criar_clinica("del_tenant", "del.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.integracoes.google_calendar import reconciliar_google

            consulta = _consulta(dentista_cred=True)
            cred = CredencialGoogleCalendar.objects.filter(dentista__isnull=False).first()
            AgendaEvento.objects.create(
                consulta=consulta,
                credencial=cred,
                google_event_id="gid-9",
                calendar_id="primary",
            )
            # Excluir NÃO chama o Google na hora: só enfileira o tombstone.
            consulta.delete()
            assert EventoGoogleRemovido.objects.filter(google_event_id="gid-9").count() == 1

            # A reconciliação apaga por ID e limpa o tombstone.
            service, events = _mock_service()
            with patch("apps.integracoes.google_calendar.build", return_value=service):
                resumo = reconciliar_google()
            assert events.delete.called
            assert resumo["removidos"] >= 1
            # O tombstone é MANTIDO (marcado processado) como guarda anti-reimport,
            # em vez de apagado na hora.
            marca = EventoGoogleRemovido.objects.get(google_event_id="gid-9")
            assert marca.processado is True
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
            from apps.integracoes.google_calendar import (
                COR_CONFIRMADA,
                COR_PENDENTE,
                COR_REALIZADA,
                _event_body,
            )

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

            # Pendente -> azul; e o telefone FORMATADO na descrição.
            body = _event_body(consulta)
            assert body["colorId"] == COR_PENDENTE
            assert "Telefone: (11) 98888-7777" in body["description"]

            # Confirmada -> verde.
            consulta.status_confirmacao = Consulta.StatusConfirmacao.CONFIRMADA
            assert _event_body(consulta)["colorId"] == COR_CONFIRMADA

            # Realizada -> verde-escuro.
            consulta.status = Consulta.Status.REALIZADA
            assert _event_body(consulta)["colorId"] == COR_REALIZADA
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


# --- A1/A2: remoção no cancelamento e re-sync no reagendamento ---


@pytest.mark.django_db(transaction=True)
def test_remover_evento_deleta_no_google_e_espelho():
    clinica = _criar_clinica("rm_ok_tenant", "rmok.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.integracoes.google_calendar import remover_evento, sincronizar_consulta

            consulta = _consulta(dentista_cred=True)
            service, events = _mock_service(event_id="gid-del")
            with patch("apps.integracoes.google_calendar.build", return_value=service):
                sincronizar_consulta(consulta)  # cria o evento no Google
                evento = AgendaEvento.objects.get(consulta=consulta)
                cal_id = evento.calendar_id

                assert remover_evento(consulta) is True
                events.delete.assert_called_once_with(calendarId=cal_id, eventId="gid-del")
                assert not AgendaEvento.objects.filter(consulta=consulta).exists()
                consulta.refresh_from_db()
                assert consulta.google_event_id == ""
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_remover_evento_ja_removido_no_google_limpa_espelho():
    clinica = _criar_clinica("rm_gone_tenant", "rmgone.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.integracoes.google_calendar import remover_evento, sincronizar_consulta

            consulta = _consulta(dentista_cred=True)
            service, events = _mock_service(event_id="gid-gone")
            with patch("apps.integracoes.google_calendar.build", return_value=service):
                sincronizar_consulta(consulta)
                # Google responde 404: o evento já não existe lá.
                events.delete.return_value.execute.side_effect = HttpError(
                    MagicMock(status=404, reason="Not Found"), b"{}"
                )
                assert remover_evento(consulta) is True  # espelho local ainda é limpo
                assert not AgendaEvento.objects.filter(consulta=consulta).exists()
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_remover_evento_sem_evento_ou_sem_credencial():
    clinica = _criar_clinica("rm_edge_tenant", "rmedge.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.integracoes.google_calendar import remover_evento

            # Sem AgendaEvento -> nada a remover.
            paciente = Paciente.objects.create(nome_completo="P", cpf="10120120120")
            dentista = Dentista.objects.create(nome_completo="D", cro="CRO-7")
            inicio = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=paciente,
                dentista=dentista,
                inicio=inicio,
                fim=inicio + timedelta(minutes=30),
            )
            assert remover_evento(consulta) is False

            # Com espelho mas sem credencial -> não chama o Google, mas limpa o espelho.
            AgendaEvento.objects.create(
                consulta=consulta,
                google_event_id="gid-nc",
                calendar_id="primary",
                status_sync=AgendaEvento.StatusSync.SINCRONIZADO,
            )
            assert remover_evento(consulta) is True
            assert not AgendaEvento.objects.filter(consulta=consulta).exists()
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_task_remover_evento_google():
    clinica = _criar_clinica("rm_task_tenant", "rmtask.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.integracoes.google_calendar import sincronizar_consulta

            consulta = _consulta(dentista_cred=True)
            cid = consulta.id
            service, _ = _mock_service(event_id="gid-t")
            with patch("apps.integracoes.google_calendar.build", return_value=service):
                sincronizar_consulta(consulta)
                assert remover_evento_google(clinica.schema_name, cid) is True
                assert not AgendaEvento.objects.filter(consulta_id=cid).exists()

            # id inexistente -> False (sem erro)
            assert remover_evento_google(clinica.schema_name, 999999) is False
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_sync_google_pausada_quando_modulo_desabilitado():
    clinica = _criar_clinica("pause_sync_tenant", "pausesync.localhost")
    try:
        from apps.plataforma.models import PlanoAssinatura
        from apps.integracoes.tasks import reconciliar_google, reconciliar_google_todos_tenants

        plano = PlanoAssinatura.objects.create(
            nome="Plano Básico Sem Google",
            preco_mensal=99.00,
            sync_google_ativo=False,
        )
        clinica.plano_assinatura = plano
        clinica.save()

        with schema_context(clinica.schema_name):
            consulta = _consulta(dentista_cred=True)
            cid = consulta.id

        # 1. sincronizar_evento_google deve retornar None (pausado) sem chamar API
        with patch("apps.integracoes.google_calendar.sincronizar_consulta") as mock_sync:
            resultado = sincronizar_evento_google(clinica.schema_name, cid)
            assert resultado is None
            mock_sync.assert_not_called()

        # 2. reconciliar_google deve retornar status pausado
        resumo = reconciliar_google(clinica.schema_name)
        assert resumo.get("pausado") is True

        # 3. reconciliar_google_todos_tenants deve pular a clínica
        reconciliadas = reconciliar_google_todos_tenants()
        assert reconciliadas == 0

        # 4. Ao habilitar por override, a sincronização retoma normalmente
        clinica.override_recursos = {"google_calendar": True}
        clinica.save()

        service, _ = _mock_service(event_id="gid-retomado")
        with patch("apps.integracoes.google_calendar.build", return_value=service):
            gid = sincronizar_evento_google(clinica.schema_name, cid)
            assert gid == "gid-retomado"
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)

