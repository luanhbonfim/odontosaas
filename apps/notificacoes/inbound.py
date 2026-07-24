"""
Recebimento de respostas do WhatsApp (WAHA).

Regra central: só tratamos como confirmação a resposta que **cita** (replyTo) a
mensagem de confirmação que nós enviamos. Assim um "SIM" solto no meio de uma
conversa não dispara o gatilho — precisa ser resposta à nossa mensagem. Como o
casamento é pelo ID da mensagem, também não dependemos do número/telefone (que o
WhatsApp às vezes entrega como um LID de privacidade em vez do telefone real).
"""

import unicodedata

from django.utils import timezone
from django_tenants.utils import schema_context
from requests import RequestException

from apps.agenda.models import Consulta
from apps.integracoes.tasks import sincronizar_evento_google
from apps.notificacoes.models import ConfiguracaoNotificacao, LogNotificacao
from apps.notificacoes.waha import enviar_texto, id_da_mensagem

_CONFIRMA = {"sim", "s", "1", "confirmo", "confirmar", "ok"}
_RECUSA = {"nao", "n", "2", "cancelar", "cancela", "recuso"}


def _normalizar(texto):
    texto = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    return texto.strip().lower()


def interpretar_resposta(texto):
    """Classifica a resposta do paciente: 'CONFIRMA', 'RECUSA' ou None."""
    normalizado = _normalizar(texto)
    if normalizado in _CONFIRMA:
        return "CONFIRMA"
    if normalizado in _RECUSA:
        return "RECUSA"
    return None


def schema_da_sessao(session):
    """Descobre o schema do tenant dono da `session` do WAHA."""
    from apps.tenants.models import Clinica

    for clinica in Clinica.objects.exclude(schema_name="public"):
        with schema_context(clinica.schema_name):
            if ConfiguracaoNotificacao.objects.filter(waha_session=session).exists():
                return clinica.schema_name
    return None


def _reply_to_id(payload):
    """
    ID da mensagem citada pela resposta (campo `replyTo` do WAHA).

    Dependendo do evento o WAHA entrega uma string ou um objeto; normalizamos
    para o ID em texto (ou "" quando a mensagem não cita nada).
    """
    reply = payload.get("replyTo")
    if isinstance(reply, dict):
        return reply.get("id") or reply.get("_serialized") or ""
    return reply or ""


def _consulta_da_confirmacao(reply_to):
    """
    Acha a consulta a partir da confirmação que enviamos e que o paciente citou.

    Casa o `replyTo` com o `provider_message_id` do log de envio. Usamos match
    flexível porque o replyTo às vezes vem "serializado" (ex.: `false_<jid>_<id>`),
    contendo o ID que guardamos.
    """
    if not reply_to:
        return None
    envios = (
        LogNotificacao.objects.filter(direcao=LogNotificacao.Direcao.ENVIADA)
        .exclude(provider_message_id="")
        .select_related("consulta", "consulta__paciente", "consulta__dentista")
        .order_by("-criado_em")
    )
    for envio in envios:
        pid = envio.provider_message_id
        if pid and (pid == reply_to or pid in reply_to or reply_to in pid):
            return envio.consulta
    return None


def _numero_do_remetente(payload):
    """
    Telefone real de quem enviou a mensagem.

    Quando o WhatsApp endereça por LID (privacidade), o `from` é um `@lid` e o
    telefone real vem em `_data.key.remoteJidAlt`; caso contrário usamos o próprio
    `from` (`@c.us` / `@s.whatsapp.net`). Retorna só os dígitos.
    """
    key = (payload.get("_data") or {}).get("key") or {}
    origem = key.get("remoteJidAlt") or payload.get("from") or ""
    return "".join(ch for ch in origem.split("@")[0] if ch.isdigit())


def _consulta_aguardando_confirmacao(numero):
    """
    Consulta PENDENTE do paciente (casada pelo telefone) para a qual já enviamos
    uma confirmação e cujo horário ainda não passou.

    É o que permite ao paciente (ex.: idoso) confirmar digitando só "SIM", sem
    citar a mensagem. O gatilho só age se houver uma confirmação nossa pendente
    para aquele número — um "SIM" avulso, sem confirmação pendente, é ignorado.
    """
    alvo = "".join(ch for ch in str(numero) if ch.isdigit())
    if not alvo:
        return None
    envios = (
        LogNotificacao.objects.filter(direcao=LogNotificacao.Direcao.ENVIADA)
        .exclude(provider_message_id="")
        .filter(
            consulta__status_confirmacao=Consulta.StatusConfirmacao.PENDENTE,
            consulta__inicio__gte=timezone.now(),
        )
        .select_related("consulta", "consulta__paciente", "consulta__dentista")
        .order_by("consulta__inicio")
    )
    for envio in envios:
        tel = "".join(ch for ch in envio.consulta.paciente.telefone_whatsapp if ch.isdigit())
        if tel and (tel == alvo or tel.endswith(alvo) or alvo.endswith(tel)):
            return envio.consulta
    return None


def _enviar_agradecimento(consulta):
    """Manda ao paciente uma mensagem simpática confirmando o horário."""
    config = ConfiguracaoNotificacao.objects.filter(ativo=True).first()
    if config is None or not config.waha_session:
        return
    quando = timezone.localtime(consulta.inicio).strftime("%d/%m às %H:%M")
    mensagem = (
        f"Perfeito, {consulta.paciente.nome_completo}! ✅\n"
        f"Sua consulta com {consulta.dentista.nome_completo} está confirmada "
        f"para {quando}. Até lá! 😊"
    )
    try:
        resposta = enviar_texto(config.waha_session, consulta.paciente.telefone_whatsapp, mensagem)
        status = LogNotificacao.Status.ENVIADA
    except RequestException as exc:
        resposta = {"erro": str(exc)}
        status = LogNotificacao.Status.ERRO

    LogNotificacao.objects.create(
        consulta=consulta,
        direcao=LogNotificacao.Direcao.ENVIADA,
        mensagem=mensagem,
        status=status,
        enviado_em=timezone.now(),
        provider_message_id=id_da_mensagem(resposta),
        payload_provedor=resposta if isinstance(resposta, dict) else {},
    )


def registrar_resposta(schema_name, payload):
    """
    No schema do tenant: liga a resposta à consulta certa, aplica-a e registra o log.

    Casamento (nesta ordem):
      1) o paciente **respondeu citando** (replyTo) a confirmação que enviamos —
         preciso, imune a "SIM" solto;
      2) SIM/NÃO **digitado direto**: casa pelo **telefone do paciente**, desde que
         exista uma confirmação nossa pendente para ele (permite o idoso só digitar
         "SIM"). Sem confirmação pendente para aquele número, é ignorado.

    CONFIRMA -> status_confirmacao=CONFIRMADA (+ confirmado_em), dispara a
    sincronização com o Google Agenda e envia o agradecimento. RECUSA -> RECUSADA.
    Retorna o LogNotificacao de entrada ou None quando a resposta é ignorada.
    """
    texto = payload.get("body") or ""
    interpretacao = interpretar_resposta(texto)

    consulta = _consulta_da_confirmacao(_reply_to_id(payload))
    if consulta is None and interpretacao is not None:
        consulta = _consulta_aguardando_confirmacao(_numero_do_remetente(payload))
    if consulta is None:
        return None  # não conseguimos ligar a resposta a uma confirmação -> ignora

    if interpretacao == "CONFIRMA":
        consulta.status_confirmacao = Consulta.StatusConfirmacao.CONFIRMADA
        consulta.confirmado_em = timezone.now()
        consulta.save(update_fields=["status_confirmacao", "confirmado_em", "atualizado_em"])
        # Gatilho: grava/atualiza o evento no Google Agenda da clínica.
        sincronizar_evento_google.delay(schema_name, consulta.id)
        _enviar_agradecimento(consulta)
    elif interpretacao == "RECUSA":
        consulta.status_confirmacao = Consulta.StatusConfirmacao.RECUSADA
        consulta.save(update_fields=["status_confirmacao", "atualizado_em"])

    return LogNotificacao.objects.create(
        consulta=consulta,
        direcao=LogNotificacao.Direcao.RECEBIDA,
        mensagem=texto,
        resposta_paciente=texto,
        status=LogNotificacao.Status.RESPONDIDA,
        respondido_em=timezone.now(),
        payload_provedor=payload or {},
    )
