"""
Recebimento de respostas do WhatsApp (WAHA).

Regra central: só tratamos como confirmação a resposta que **cita** (replyTo) a
mensagem de confirmação que nós enviamos. Assim um "SIM" solto no meio de uma
conversa não dispara o gatilho — precisa ser resposta à nossa mensagem. Como o
casamento é pelo ID da mensagem, também não dependemos do número/telefone (que o
WhatsApp às vezes entrega como um LID de privacidade em vez do telefone real).
"""

import unicodedata
from datetime import timedelta

from django.utils import timezone
from django_tenants.utils import schema_context
from requests import RequestException

from apps.agenda.models import Consulta

# Mantido importável: o reflexo no Google agora é pela sync periódica (não aqui),
# mas os testes ainda fazem patch deste símbolo. noqa evita o F401.
from apps.integracoes.tasks import sincronizar_evento_google  # noqa: F401
from apps.notificacoes.models import ConfiguracaoNotificacao, LogNotificacao, TemplateMensagem
from apps.notificacoes.waha import (
    enviar_digitando,
    enviar_texto,
    id_da_mensagem,
    numero_valido,
)

_CONFIRMA = {"sim", "s", "1", "confirmo", "confirmar", "ok"}
_RECUSA = {"nao", "n", "2", "cancelar", "cancela", "recuso"}
# Uma confirmação enviada há mais que isso não é mais casada com um "sim" avulso.
_JANELA_CONFIRMACAO_DIAS = 30


def _normalizar(texto):
    texto = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    # minúsculas + tira pontuação/espaços das bordas ("Sim!", "SIM." , " sim " -> "sim").
    return texto.strip().lower().strip(".,!?;:)('\"- ")


def _palavras(config_valor, padrao):
    """Conjunto de palavras (normalizadas) do config, ou o padrão se vazio."""
    if not config_valor:
        return padrao
    return {_normalizar(p) for p in config_valor.split(",") if p.strip()}


def interpretar_resposta(texto, confirma=None, recusa=None):
    """Classifica a resposta do paciente: 'CONFIRMA', 'RECUSA' ou None.

    `confirma`/`recusa` são conjuntos de palavras (gatilho configurável); quando
    ausentes, usa o padrão do sistema.
    """
    normalizado = _normalizar(texto)
    if normalizado in (confirma or _CONFIRMA):
        return "CONFIRMA"
    if normalizado in (recusa or _RECUSA):
        return "RECUSA"
    return None


def schema_da_sessao(session):
    """Descobre o schema do tenant dono da `session` do WAHA."""
    from apps.tenants.models import Clinica

    # 1. Busca direta O(1): na convenção padrão a sessão é igual ao schema_name
    clinica_direta = Clinica.objects.filter(schema_name=session).first()
    if clinica_direta and clinica_direta.schema_name != "public":
        if hasattr(clinica_direta, "recurso_habilitado") and not clinica_direta.recurso_habilitado("whatsapp"):
            return None
        return clinica_direta.schema_name

    # 2. Fallback caso a sessão seja customizada
    for clinica in Clinica.objects.exclude(schema_name="public"):
        if hasattr(clinica, "recurso_habilitado") and not clinica.recurso_habilitado("whatsapp"):
            continue
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
    # Só a mensagem de CONFIRMAÇÃO abre o gatilho de sim/não. Responder ao
    # reagendamento/aviso/agradecimento (com figurinha, "ok", etc.) NÃO conta —
    # senão o reforço "responda SIM ou NÃO" dispararia fora de hora.
    envios = (
        LogNotificacao.objects.filter(
            direcao=LogNotificacao.Direcao.ENVIADA,
            template__tipo=TemplateMensagem.Tipo.CONFIRMACAO,
        )
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
    telefone real vem num campo alternativo — que muda conforme o engine do WAHA:
      - GOWS:  `_data.Info.SenderAlt` (ex.: `55...@s.whatsapp.net`);
      - NOWEB: `_data.key.remoteJidAlt`.
    Sem LID, usamos o próprio `from` (`@c.us` / `@s.whatsapp.net`). Só dígitos.
    """
    dados = payload.get("_data") or {}
    info = dados.get("Info") or {}
    key = dados.get("key") or {}
    origem = (
        info.get("SenderAlt")  # GOWS
        or key.get("remoteJidAlt")  # NOWEB
        or payload.get("from")
        or ""
    )
    # O JID pode vir como "<numero>:<dispositivo>@servidor" (ex.: GOWS manda
    # "5518996902466:93@s.whatsapp.net"). Corta no "@" e no ":" (sufixo de
    # dispositivo) antes de extrair os dígitos — senão o número sai errado.
    numero = origem.split("@")[0].split(":")[0]
    return "".join(ch for ch in numero if ch.isdigit())


def _consulta_aguardando_confirmacao(numero):
    """
    Consulta PENDENTE do paciente (casada pelo telefone) para a qual já enviamos
    uma confirmação e cujo horário ainda não passou.

    É o que permite ao paciente (ex.: idoso) confirmar digitando só "SIM", sem
    citar a mensagem. O gatilho só age se houver uma confirmação nossa pendente
    para aquele número — um "SIM" avulso, sem confirmação pendente, é ignorado.

    Com **múltiplas** consultas pendentes do mesmo número, casa com a **confirmação
    mais recente enviada** (a última mensagem que o paciente viu no chat). Para
    escolher outra, o paciente deve **citar** a mensagem (tratado antes, por
    `replyTo`). Só considera confirmações enviadas na janela recente.
    """
    alvo = "".join(ch for ch in str(numero) if ch.isdigit())
    if not alvo:
        return None
    limite = timezone.now() - timedelta(days=_JANELA_CONFIRMACAO_DIAS)
    envios = (
        LogNotificacao.objects.filter(
            direcao=LogNotificacao.Direcao.ENVIADA, criado_em__gte=limite
        )
        .exclude(provider_message_id="")
        .filter(
            consulta__status_confirmacao=Consulta.StatusConfirmacao.PENDENTE,
            consulta__inicio__gte=timezone.now(),
        )
        .select_related("consulta", "consulta__paciente", "consulta__dentista")
        .order_by("-criado_em", "-id")  # a confirmação MAIS RECENTE enviada
    )
    for envio in envios:
        tel = "".join(ch for ch in envio.consulta.paciente.telefone_whatsapp if ch.isdigit())
        if tel and (tel == alvo or tel.endswith(alvo) or alvo.endswith(tel)):
            return envio.consulta
    return None


def _enviar_agradecimento(consulta):
    """Manda ao paciente uma mensagem simpática confirmando o horário.

    Usa o template AGRADECIMENTO (ativo), se houver; senão, um texto padrão.
    """
    config = ConfiguracaoNotificacao.objects.filter(ativo=True).first()
    if config is None or not config.waha_session or not config.enviar_agradecimento:
        return

    template = TemplateMensagem.objects.filter(
        tipo=TemplateMensagem.Tipo.AGRADECIMENTO, ativo=True
    ).first()
    from apps.notificacoes.defaults import CORPO_PADRAO_AGRADECIMENTO
    from apps.notificacoes.tasks import _renderizar

    corpo = template.corpo if template else CORPO_PADRAO_AGRADECIMENTO
    mensagem = _renderizar(corpo, consulta)
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


_REFORCO_PADRAO = "Por favor, responda apenas com *SIM* ou *NÃO*. 🙏"


def _reforcar_confirmacao(consulta, config):
    """Reenvia o pedido de responder apenas SIM/NÃO (com 'digitando…' antes).

    Só age se a clínica ativou o reforço e há sessão/telefone válidos.
    """
    if config is None or not config.reforcar_confirmacao or not config.waha_session:
        return
    if not numero_valido(consulta.paciente.telefone_whatsapp):
        return
    texto = config.mensagem_reforco or _REFORCO_PADRAO
    numero = consulta.paciente.telefone_whatsapp
    enviar_digitando(config.waha_session, numero)  # efeito visual (best-effort)
    try:
        resposta = enviar_texto(config.waha_session, numero, texto)
        status = LogNotificacao.Status.ENVIADA
    except RequestException as exc:
        resposta = {"erro": str(exc)}
        status = LogNotificacao.Status.ERRO
    LogNotificacao.objects.create(
        consulta=consulta,
        direcao=LogNotificacao.Direcao.ENVIADA,
        mensagem=texto,
        status=status,
        enviado_em=timezone.now(),
        provider_message_id=id_da_mensagem(resposta),
        payload_provedor=resposta if isinstance(resposta, dict) else {},
    )


def aplicar_resposta(consulta, interpretacao, schema_name):
    """Aplica CONFIRMA/RECUSA a uma consulta (reusado pelo WhatsApp e pelo link).

    CONFIRMA -> CONFIRMADA (+ agradecimento). RECUSA -> RECUSADA (+ cancela, se
    possível; o cancelamento avisa o paciente via signal). A cor/estado no Google
    é refletida pela sincronização periódica (não imediata).
    """
    if interpretacao == "CONFIRMA":
        consulta.status_confirmacao = Consulta.StatusConfirmacao.CONFIRMADA
        consulta.confirmado_em = timezone.now()
        consulta.save(update_fields=["status_confirmacao", "confirmado_em", "atualizado_em"])
        _enviar_agradecimento(consulta)
    elif interpretacao == "RECUSA":
        consulta.status_confirmacao = Consulta.StatusConfirmacao.RECUSADA
        campos = ["status_confirmacao", "atualizado_em"]
        if consulta.pode_transicionar_para(Consulta.Status.CANCELADA):
            consulta.status = Consulta.Status.CANCELADA
            campos.append("status")
        consulta.save(update_fields=campos)


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
    config = ConfiguracaoNotificacao.objects.filter(ativo=True).first()
    interpretacao = interpretar_resposta(
        texto,
        _palavras(config.palavras_confirmacao if config else "", _CONFIRMA),
        _palavras(config.palavras_recusa if config else "", _RECUSA),
    )

    consulta = _consulta_da_confirmacao(_reply_to_id(payload))
    if consulta is None:
        # Casa pelo telefone — vale para aplicar (sim/não) e para reforçar (texto solto).
        consulta = _consulta_aguardando_confirmacao(_numero_do_remetente(payload))
    if consulta is None:
        return None  # não conseguimos ligar a resposta a uma confirmação -> ignora

    if interpretacao is None:
        # Resposta que não é sim/não: só reforça se AINDA houver confirmação
        # pendente para esta consulta (se já confirmou/recusou, não insiste).
        if consulta.status_confirmacao == Consulta.StatusConfirmacao.PENDENTE:
            _reforcar_confirmacao(consulta, config)
    else:
        aplicar_resposta(consulta, interpretacao, schema_name)

    return LogNotificacao.objects.create(
        consulta=consulta,
        direcao=LogNotificacao.Direcao.RECEBIDA,
        mensagem=texto,
        resposta_paciente=texto,
        status=LogNotificacao.Status.RESPONDIDA,
        respondido_em=timezone.now(),
        payload_provedor=payload or {},
    )
