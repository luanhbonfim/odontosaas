"""
Serviço de sincronização de consultas com o Google Calendar.

Isolado da task Celery para facilitar o mock nos testes (basta mockar `build`).
"""

import datetime as dt
import re
import uuid

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

from apps.agenda.models import AgendaEvento, Consulta
from apps.integracoes.models import CredencialGoogleCalendar

TOKEN_URI = "https://oauth2.googleapis.com/token"

# Sequência que se parece com um telefone (dígitos com separadores comuns).
_TELEFONE_RE = re.compile(r"\+?\d[\d\s().-]{8,}\d")


def _credencial_para(consulta):
    """Credencial do dentista da consulta; se não houver, a da clínica."""
    cred = CredencialGoogleCalendar.objects.filter(dentista=consulta.dentista, ativo=True).first()
    if cred is None:
        cred = CredencialGoogleCalendar.objects.filter(dentista__isnull=True, ativo=True).first()
    return cred


def build_service(credencial):
    creds = Credentials(
        token=credencial.access_token,
        refresh_token=credencial.refresh_token,
        token_uri=TOKEN_URI,
        client_id=settings.GOOGLE_OAUTH_CLIENT_ID,
        client_secret=settings.GOOGLE_OAUTH_CLIENT_SECRET,
        scopes=credencial.scope.split() if credencial.scope else None,
    )
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


# Google Calendar colorId "10" = Basil (verde). Usado quando a consulta está confirmada.
COR_CONFIRMADA = "10"


def _event_body(consulta):
    paciente = consulta.paciente
    body = {
        "summary": f"{paciente.nome_completo} - {consulta.procedimento or 'Consulta'}",
        "description": (
            f"Paciente: {paciente.nome_completo}\n"
            f"Telefone: {paciente.telefone_formatado}\n"
            f"Dentista: {consulta.dentista.nome_completo}"
        ),
        "start": {"dateTime": consulta.inicio.isoformat()},
        "end": {"dateTime": consulta.fim.isoformat()},
    }
    # Consulta confirmada pelo paciente fica verde na agenda.
    if consulta.status_confirmacao == Consulta.StatusConfirmacao.CONFIRMADA:
        body["colorId"] = COR_CONFIRMADA
    return body


def sincronizar_consulta(consulta):
    """Cria/atualiza o evento no Google Calendar e espelha em AgendaEvento."""
    credencial = _credencial_para(consulta)
    evento, _ = AgendaEvento.objects.get_or_create(
        consulta=consulta,
        defaults={"calendar_id": credencial.calendar_id if credencial else "primary"},
    )

    if credencial is None:
        evento.status_sync = AgendaEvento.StatusSync.ERRO
        evento.save(update_fields=["status_sync", "atualizado_em"])
        return evento

    service = build_service(credencial)
    body = _event_body(consulta)
    events = service.events()
    if evento.google_event_id:
        resultado = events.update(
            calendarId=evento.calendar_id, eventId=evento.google_event_id, body=body
        ).execute()
    else:
        resultado = events.insert(calendarId=evento.calendar_id, body=body).execute()

    evento.google_event_id = resultado.get("id", evento.google_event_id)
    evento.etag = resultado.get("etag", "")
    evento.status_sync = AgendaEvento.StatusSync.SINCRONIZADO
    evento.ultima_sincronizacao = timezone.now()
    evento.save()

    # Atalho denormalizado na própria consulta.
    if consulta.google_event_id != evento.google_event_id:
        consulta.google_event_id = evento.google_event_id
        consulta.save(update_fields=["google_event_id", "atualizado_em"])

    return evento


def _extrair_telefone(texto):
    """Extrai o primeiro telefone (10-13 dígitos) de um texto livre."""
    for trecho in _TELEFONE_RE.findall(texto or ""):
        digitos = "".join(ch for ch in trecho if ch.isdigit())
        if 10 <= len(digitos) <= 13:
            return digitos
    return ""


def _obter_ou_criar_paciente(telefone, nome):
    """Acha o paciente pelo telefone (compara dígitos) ou cria um novo (sem CPF)."""
    from apps.pacientes.models import Paciente

    alvo = "".join(ch for ch in telefone if ch.isdigit())
    for paciente in Paciente.objects.all():
        tel = "".join(ch for ch in paciente.telefone_whatsapp if ch.isdigit())
        if tel and (tel == alvo or tel.endswith(alvo) or alvo.endswith(tel)):
            return paciente
    return Paciente.objects.create(
        nome_completo=nome or "Paciente (Google Agenda)", telefone_whatsapp=alvo
    )


def _importar_evento(item, credencial):
    """
    Cria uma Consulta a partir de um evento que a dentista criou no Google Agenda.

    Convenção: título = nome do paciente, telefone na descrição. Sem telefone, sem
    horário definido (evento de dia inteiro) ou sem dentista, o evento é ignorado.
    """
    from apps.dentistas.models import Dentista

    if item.get("status") == "cancelled":
        return None
    inicio = (item.get("start") or {}).get("dateTime")
    fim = (item.get("end") or {}).get("dateTime")
    if not inicio or not fim:
        return None
    telefone = _extrair_telefone(item.get("description", ""))
    if not telefone:
        return None
    dentista = credencial.dentista or Dentista.objects.filter(ativo=True).first()
    if dentista is None:
        return None

    paciente = _obter_ou_criar_paciente(telefone, (item.get("summary") or "").strip())
    consulta = Consulta.objects.create(
        paciente=paciente,
        dentista=dentista,
        inicio=parse_datetime(inicio),
        fim=parse_datetime(fim),
        google_event_id=item.get("id", ""),
        observacoes="Importado do Google Agenda",
    )
    AgendaEvento.objects.create(
        consulta=consulta,
        google_event_id=item.get("id", ""),
        calendar_id=credencial.calendar_id,
        etag=item.get("etag", ""),
        status_sync=AgendaEvento.StatusSync.SINCRONIZADO,
        ultima_sincronizacao=timezone.now(),
    )
    return consulta


def _aplicar_mudanca(item, credencial):
    """Aplica localmente uma mudança vinda do Google (novo/alterado/cancelado)."""
    evento = AgendaEvento.objects.filter(google_event_id=item.get("id")).first()
    if evento is None:
        # Evento que a dentista criou direto no Google -> importa como Consulta.
        _importar_evento(item, credencial)
        return
    evento.etag = item.get("etag", evento.etag)
    evento.status_sync = AgendaEvento.StatusSync.SINCRONIZADO
    evento.ultima_sincronizacao = timezone.now()
    evento.save()

    if item.get("status") == "cancelled" and evento.consulta.status != Consulta.Status.CANCELADA:
        consulta = evento.consulta
        consulta.status = Consulta.Status.CANCELADA
        consulta.save(update_fields=["status", "atualizado_em"])


def sincronizar_incremental(credencial):
    """
    Puxa as mudanças do Google via events.list(syncToken=...) e aplica localmente.
    Persiste o nextSyncToken na credencial. Retorna a quantidade de itens.
    """
    service = build_service(credencial)
    kwargs = {"calendarId": credencial.calendar_id}
    if credencial.sync_token:
        kwargs["syncToken"] = credencial.sync_token
    resultado = service.events().list(**kwargs).execute()

    itens = resultado.get("items", [])
    for item in itens:
        _aplicar_mudanca(item, credencial)

    novo_token = resultado.get("nextSyncToken")
    if novo_token:
        credencial.sync_token = novo_token
        credencial.save(update_fields=["sync_token", "atualizado_em"])
    return len(itens)


def registrar_watch(credencial, webhook_url, channel_id=None):
    """Registra um canal de push notifications (watch) para o calendário."""
    channel_id = channel_id or str(uuid.uuid4())
    service = build_service(credencial)
    resultado = (
        service.events()
        .watch(
            calendarId=credencial.calendar_id,
            body={"id": channel_id, "type": "web_hook", "address": webhook_url},
        )
        .execute()
    )
    credencial.watch_channel_id = resultado.get("id", channel_id)
    credencial.watch_resource_id = resultado.get("resourceId", "")
    expiration = resultado.get("expiration")
    if expiration:
        credencial.watch_expiration = dt.datetime.fromtimestamp(int(expiration) / 1000, tz=dt.UTC)
    credencial.save(
        update_fields=[
            "watch_channel_id",
            "watch_resource_id",
            "watch_expiration",
            "atualizado_em",
        ]
    )
    return credencial
