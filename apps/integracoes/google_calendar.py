"""
Serviço de sincronização de consultas com o Google Calendar.

Isolado da task Celery para facilitar o mock nos testes (basta mockar `build`).
"""

import contextlib
import datetime as dt
import hashlib
import re
import uuid

from django.conf import settings
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from apps.agenda.models import AgendaEvento, Consulta, EventoGoogleRemovido
from apps.integracoes.models import ConfiguracaoSincronizacao, CredencialGoogleCalendar

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


# Cor do evento no Google (colorId) espelhando a nossa agenda:
#   Pendente (agendada, sem confirmar) -> azul   (Blueberry "9")
#   Confirmado (agendada + confirmada) -> verde   (Sage "2")
#   Realizada                          -> verde-escuro (Basil "10")
# EM_ATENDIMENTO / CANCELADA / FALTOU não vão para o Google (ver signals).
COR_PENDENTE = "9"
COR_CONFIRMADA = "2"
COR_REALIZADA = "10"


def _cor_do_evento(consulta):
    if consulta.status == Consulta.Status.REALIZADA:
        return COR_REALIZADA
    if consulta.status_confirmacao == Consulta.StatusConfirmacao.CONFIRMADA:
        return COR_CONFIRMADA
    return COR_PENDENTE


def _assinatura(consulta):
    """Hash do que é enviado ao Google (título, horário, cor). Muda só quando algo
    relevante muda -> a reconciliação evita re-enviar o que não mexeu."""
    body = _event_body(consulta)
    base = "|".join(
        [
            body["summary"],
            body["start"]["dateTime"],
            body["end"]["dateTime"],
            body["colorId"],
        ]
    )
    return hashlib.sha256(base.encode()).hexdigest()[:32]


def _event_body(consulta):
    paciente = consulta.paciente
    return {
        "summary": f"{paciente.nome_completo} - {consulta.procedimento or 'Consulta'}",
        "description": (
            f"Paciente: {paciente.nome_completo}\n"
            f"Telefone: {paciente.telefone_formatado}\n"
            f"Dentista: {consulta.dentista.nome_completo}"
        ),
        "start": {"dateTime": consulta.inicio.isoformat()},
        "end": {"dateTime": consulta.fim.isoformat()},
        "colorId": _cor_do_evento(consulta),
    }


def sincronizar_consulta(consulta, credencial=None):
    """Cria/atualiza o evento no Google e espelha em AgendaEvento.

    `credencial` explícita (reconciliação multi-agenda) ou, na falta, a rota
    padrão (dentista da consulta ou clínica). Um evento por (consulta, credencial).
    """
    if credencial is None:
        credencial = _credencial_para(consulta)

    if credencial is None:
        evento, _ = AgendaEvento.objects.get_or_create(
            consulta=consulta, credencial=None, defaults={"calendar_id": "primary"}
        )
        evento.status_sync = AgendaEvento.StatusSync.ERRO
        evento.save(update_fields=["status_sync", "atualizado_em"])
        return evento

    evento, _ = AgendaEvento.objects.get_or_create(
        consulta=consulta,
        credencial=credencial,
        defaults={"calendar_id": credencial.calendar_id},
    )

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
    evento.assinatura = _assinatura(consulta)
    evento.status_sync = AgendaEvento.StatusSync.SINCRONIZADO
    evento.ultima_sincronizacao = timezone.now()
    evento.save()

    # Atalho denormalizado na própria consulta.
    if consulta.google_event_id != evento.google_event_id:
        consulta.google_event_id = evento.google_event_id
        consulta.save(update_fields=["google_event_id", "atualizado_em"])

    return evento


def remover_evento_por_id(dentista_id, calendar_id, event_id):
    """Deleta um evento do Google pelo ID, sem depender da consulta (que pode já
    ter sido excluída). Usa a credencial do dentista ou, na falta, a da clínica."""
    if not event_id:
        return False
    credencial = CredencialGoogleCalendar.objects.filter(
        dentista_id=dentista_id, ativo=True
    ).first()
    if credencial is None:
        credencial = CredencialGoogleCalendar.objects.filter(
            dentista__isnull=True, ativo=True
        ).first()
    if credencial is None:
        return False
    service = build_service(credencial)
    # HttpError -> evento já não existe no Google (404/410); tratado como removido.
    with contextlib.suppress(HttpError):
        service.events().delete(calendarId=calendar_id or "primary", eventId=event_id).execute()
    return True


def remover_evento(consulta):
    """
    Remove do Google TODOS os eventos da consulta (uma por agenda/credencial) e
    apaga os espelhos locais. Sem evento sincronizado, não faz nada.
    Retorna True se havia ao menos um evento para remover.
    """
    eventos = list(AgendaEvento.objects.filter(consulta=consulta))
    if not any(e.google_event_id for e in eventos):
        if eventos:  # limpa espelhos vazios
            AgendaEvento.objects.filter(consulta=consulta).delete()
        return False

    for evento in eventos:
        credencial = evento.credencial or _credencial_para(consulta)
        if credencial is not None and evento.google_event_id:
            service = build_service(credencial)
            # HttpError -> evento já não existe no Google (404/410); segue e limpa.
            with contextlib.suppress(HttpError):
                service.events().delete(
                    calendarId=evento.calendar_id, eventId=evento.google_event_id
                ).execute()
        evento.delete()

    if consulta.google_event_id:
        consulta.google_event_id = ""
        consulta.save(update_fields=["google_event_id", "atualizado_em"])
    return True


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
    # Guarda anti-reimport: se este evento foi EXCLUÍDO por nós (tem tombstone),
    # não recria a consulta — mesmo que um events.list completo ainda o traga ativo.
    event_id = item.get("id", "")
    if event_id and EventoGoogleRemovido.objects.filter(google_event_id=event_id).exists():
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


# --- Reconciliação periódica (G5) --------------------------------------------
# Status que DEVEM aparecer no Google (os demais saem: EM_ATENDIMENTO/CANCELADA/
# FALTOU). A reconciliação roda por credencial (agenda), aplicando o escopo.
_STATUS_NO_GOOGLE = {Consulta.Status.AGENDADA, Consulta.Status.REALIZADA}


def aplicar_regra_nao_confirmada():
    """Cancela consultas AGENDADA+PENDENTE não confirmadas até X horas do início.

    Só age se a clínica ativou a flag em ConfiguracaoNotificacao
    (`cancelar_nao_confirmadas`), usando `cancelar_horas_antes`. A consulta fica
    CANCELADA na nossa agenda (sai do Google na reconciliação). Retorna a contagem.
    """
    from apps.notificacoes.models import ConfiguracaoNotificacao

    cfg = ConfiguracaoNotificacao.objects.filter(ativo=True).first()
    if cfg is None or not cfg.cancelar_nao_confirmadas:
        return 0
    limite = timezone.now() + dt.timedelta(hours=cfg.cancelar_horas_antes)
    pendentes = list(
        Consulta.objects.filter(
            status=Consulta.Status.AGENDADA,
            status_confirmacao=Consulta.StatusConfirmacao.PENDENTE,
            inicio__lte=limite,
        )
    )
    for consulta in pendentes:
        consulta.status = Consulta.Status.CANCELADA
        consulta.save(update_fields=["status", "atualizado_em"])
    return len(pendentes)


def _consultas_no_google_para(credencial):
    """Consultas que devem estar no Google nesta credencial (escopo + status).

    Credencial da clínica (dentista nulo) = TODAS; credencial de um dentista =
    apenas as consultas dele.
    """
    qs = Consulta.objects.filter(status__in=_STATUS_NO_GOOGLE).select_related(
        "paciente", "dentista"
    )
    if credencial.dentista_id is not None:
        qs = qs.filter(dentista_id=credencial.dentista_id)
    return qs


def reconciliar_google(credenciais=None, aplicar_cancelamento=True):
    """Reconcilia (por ID) as consultas do tenant atual com o Google Calendar.

    - `aplicar_cancelamento` (padrão) roda a regra de 'não confirmada' (cancela e
      remove do Google) — ação de nível clínica; desligue no force de um dentista.
    - `credenciais` limita as agendas reconciliadas (padrão: todas as ativas).
      Cada agenda recebe seu escopo: clínica vê todas, dentista só as suas.

    Retorna {criados, atualizados, removidos, canceladas}.
    """
    # get_or_create garante a linha (para carimbar a última sincronização e para
    # a tela mostrar o intervalo/última/próxima).
    config, _ = ConfiguracaoSincronizacao.objects.get_or_create()
    canceladas = 0
    if aplicar_cancelamento:
        canceladas = aplicar_regra_nao_confirmada()

    if credenciais is None:
        credenciais = CredencialGoogleCalendar.objects.filter(ativo=True)

    criados = atualizados = removidos = 0

    # Remoções de consultas EXCLUÍDAS (tombstones) — só no reconcile de clínica.
    if aplicar_cancelamento:
        for marca in EventoGoogleRemovido.objects.filter(processado=False).select_related(
            "credencial"
        ):
            if marca.credencial_id and marca.google_event_id:
                with contextlib.suppress(HttpError):
                    build_service(marca.credencial).events().delete(
                        calendarId=marca.calendar_id, eventId=marca.google_event_id
                    ).execute()
                removidos += 1
            # Mantém o tombstone (marcado) como guarda anti-reimport; ele é podado
            # depois de uma janela (o events.list já refletiu a exclusão até lá).
            marca.processado = True
            marca.save(update_fields=["processado", "atualizado_em"])
        janela = timezone.now() - dt.timedelta(days=7)
        EventoGoogleRemovido.objects.filter(processado=True, criado_em__lt=janela).delete()

    for credencial in credenciais:
        alvo = list(_consultas_no_google_para(credencial))
        alvo_ids = set()
        for consulta in alvo:
            evento = AgendaEvento.objects.filter(
                consulta=consulta, credencial=credencial
            ).first()
            assinatura = _assinatura(consulta)
            # Snapshot/diff: só cria (novo) ou atualiza (mudou de fato); o que já
            # está igual no Google é ignorado (não conta como "atualizado").
            if evento is None or not evento.google_event_id:
                with contextlib.suppress(HttpError):
                    sincronizar_consulta(consulta, credencial)
                    criados += 1
            elif evento.assinatura != assinatura:
                with contextlib.suppress(HttpError):
                    sincronizar_consulta(consulta, credencial)
                    atualizados += 1
            alvo_ids.add(consulta.id)

        # Eventos desta agenda cujas consultas saíram do escopo/estado (ex.:
        # cancelada/faltou que estava no Google) -> remove do Google, mantém no app.
        obsoletos = AgendaEvento.objects.filter(credencial=credencial).exclude(
            consulta_id__in=alvo_ids
        )
        for evento in obsoletos:
            if evento.google_event_id:
                with contextlib.suppress(HttpError):
                    build_service(credencial).events().delete(
                        calendarId=evento.calendar_id, eventId=evento.google_event_id
                    ).execute()
                removidos += 1
            evento.delete()

    # Só a reconciliação de nível clínica (Beat/gestor) carimba a última sync.
    if aplicar_cancelamento:
        config.ultima_sincronizacao = timezone.now()
        config.save(update_fields=["ultima_sincronizacao", "atualizado_em"])
    return {
        "criados": criados,
        "atualizados": atualizados,
        "removidos": removidos,
        "canceladas": canceladas,
    }
