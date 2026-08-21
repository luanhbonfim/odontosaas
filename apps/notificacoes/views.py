"""Views do app notificacoes (API REST + webhook do WAHA)."""

import hmac
import json
import logging

from django.conf import settings
from django.db import connection
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django_tenants.utils import schema_context
from drf_spectacular.utils import extend_schema
from requests import RequestException
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .inbound import registrar_resposta, schema_da_sessao
from .models import ConfiguracaoNotificacao, LogNotificacao, TemplateMensagem
from .serializers import (
    ConfiguracaoNotificacaoSerializer,
    LogNotificacaoSerializer,
    TemplateMensagemSerializer,
)

logger = logging.getLogger(__name__)


def _motivo_falha_envio(payload):
    """Traduz o erro do WAHA numa mensagem acionável para o usuário."""
    texto = str((payload or {}).get("erro", "")).lower()
    if "no lid found" in texto or "not on whatsapp" in texto or "invalid jid" in texto:
        return (
            "Número de WhatsApp do paciente inválido ou fora do WhatsApp. "
            "Confira o cadastro (DDD + número)."
        )
    if "session" in texto or "not connected" in texto or "status" in texto:
        return "WhatsApp não conectado. Conecte na aba Configuração e tente novamente."
    return "Falha ao enviar pelo WhatsApp. Verifique a conexão e o número do paciente."


class ConfiguracaoNotificacaoViewSet(viewsets.ModelViewSet):
    """Personalização das notificações da clínica (antecedência, sessão WAHA).

    Inclui o pareamento do WhatsApp por QR (via WAHA) direto no app, sem dashboard.
    """

    queryset = ConfiguracaoNotificacao.objects.all()
    serializer_class = ConfiguracaoNotificacaoSerializer

    def _sessao(self):
        """Sessão do WhatsApp = schema do tenant (uma por clínica, automática)."""
        return connection.schema_name

    def _garantir_config(self, sessao):
        """Garante uma ConfiguracaoNotificacao com a sessão do tenant gravada
        (necessário para o roteamento do webhook e para os disparos)."""
        config = ConfiguracaoNotificacao.objects.first()
        if config is None:
            config = ConfiguracaoNotificacao.objects.create(waha_session=sessao)
        elif config.waha_session != sessao:
            config.waha_session = sessao
            config.save(update_fields=["waha_session", "atualizado_em"])
        return config

    @action(detail=False, methods=["get"], url_path="whatsapp")
    def whatsapp_status(self, request):
        """Estado atual da conexão do WhatsApp da clínica (status + número)."""
        from apps.notificacoes.waha import status_sessao

        sessao = self._sessao()
        try:
            info = status_sessao(sessao)
        except RequestException:
            return Response(
                {"session": sessao, "status": "OFFLINE", "conectado": False, "numero": None}
            )
        estado = info.get("status", "STOPPED")
        me = info.get("me") or {}
        numero = (me.get("id") or "").split("@")[0] or None
        return Response(
            {"session": sessao, "status": estado, "conectado": estado == "WORKING", "numero": numero}
        )

    @action(detail=False, methods=["post"], url_path="whatsapp-conectar")
    def whatsapp_conectar(self, request):
        """Cria/inicia a sessão (= tenant) para gerar o QR de pareamento."""
        from apps.notificacoes.waha import garantir_sessao, status_sessao

        sessao = self._sessao()
        self._garantir_config(sessao)  # persiste a sessão p/ webhook e disparos
        try:
            garantir_sessao(sessao)
            info = status_sessao(sessao)
        except RequestException:
            return Response(
                {"detail": "WAHA indisponível. Verifique o servidor."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"status": info.get("status", "STARTING")})

    @action(detail=False, methods=["get"], url_path="whatsapp-qr")
    def whatsapp_qr(self, request):
        """QR de pareamento (data URI). 400 se a sessão não estiver aguardando QR."""
        from apps.notificacoes.waha import obter_qr

        try:
            qr = obter_qr(self._sessao())
        except RequestException:
            return Response(
                {"detail": "QR indisponível (a sessão pode já estar conectada)."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"qr": qr})

    @action(detail=False, methods=["post"], url_path="whatsapp-desconectar")
    def whatsapp_desconectar(self, request):
        """Encerra (logout) a sessão do WhatsApp da clínica."""
        import contextlib

        from apps.notificacoes.waha import encerrar_sessao

        sessao = self._sessao()
        if sessao:
            with contextlib.suppress(RequestException):
                encerrar_sessao(sessao)
        return Response({"status": "desconectado"})


class TemplateMensagemViewSet(viewsets.ModelViewSet):
    """CRUD dos templates de mensagem."""

    queryset = TemplateMensagem.objects.all()
    serializer_class = TemplateMensagemSerializer


class LogNotificacaoViewSet(viewsets.ReadOnlyModelViewSet):
    """Histórico de notificações (só leitura) + envio manual de confirmação.

    Filtros de querystring: `?direcao=`, `?status=`, `?consulta=`.
    """

    queryset = LogNotificacao.objects.select_related(
        "consulta", "consulta__paciente", "template"
    ).all()
    serializer_class = LogNotificacaoSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        params = self.request.query_params
        for campo in ("direcao", "status"):
            valor = params.get(campo)
            if valor:
                queryset = queryset.filter(**{campo: valor})
        consulta = params.get("consulta")
        if consulta:
            queryset = queryset.filter(consulta_id=consulta)
        return queryset

    @extend_schema(responses=dict)
    @action(detail=False, methods=["get"], url_path="fila")
    def fila(self, request):
        """Mensagens automáticas que ainda vão sair (confirmações + avisos)."""
        from apps.notificacoes.tasks import fila_pendente

        return Response(fila_pendente())

    @action(detail=False, methods=["post"], url_path="enviar-confirmacao")
    def enviar_confirmacao(self, request):
        """Envia/reenvia o pedido de confirmação de uma consulta (body: `consulta`)."""
        from apps.agenda.models import Consulta
        from apps.notificacoes.tasks import enviar_confirmacao_manual

        consulta = Consulta.objects.filter(pk=request.data.get("consulta")).first()
        if consulta is None:
            return Response(
                {"detail": "Consulta não encontrada."}, status=status.HTTP_404_NOT_FOUND
            )
        try:
            log = enviar_confirmacao_manual(consulta)
        except ValueError as erro:
            return Response({"detail": str(erro)}, status=status.HTTP_400_BAD_REQUEST)
        # Falha na entrega pelo WhatsApp -> devolve 400 com motivo legível.
        if log.status == LogNotificacao.Status.ERRO:
            return Response(
                {"detail": _motivo_falha_envio(log.payload_provedor)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(LogNotificacaoSerializer(log).data, status=status.HTTP_201_CREATED)


class ConfirmacaoPublicaView(APIView):
    """Confirmação/recusa por LINK (público, sem login) — o 'botão' do WhatsApp.

    O token (UUID por consulta) resolve exatamente qual consulta é — imune à
    ambiguidade de várias consultas do mesmo paciente.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def _consulta(self, token):
        from apps.agenda.models import Consulta

        return (
            Consulta.objects.select_related("paciente", "dentista")
            .filter(confirmacao_token=token)
            .first()
        )

    @extend_schema(exclude=True)
    def get(self, request, token):
        consulta = self._consulta(token)
        if consulta is None:
            return Response({"detail": "Link inválido."}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "paciente_nome": consulta.paciente.nome_completo,
                "dentista_nome": consulta.dentista.nome_completo,
                "inicio": consulta.inicio,
                "status_confirmacao": consulta.status_confirmacao,
                "status": consulta.status,
            }
        )

    @extend_schema(exclude=True)
    def post(self, request, token):
        from apps.agenda.models import Consulta
        from apps.notificacoes.inbound import aplicar_resposta

        consulta = self._consulta(token)
        if consulta is None:
            return Response({"detail": "Link inválido."}, status=status.HTTP_404_NOT_FOUND)
        acao = request.data.get("acao")
        if acao not in ("confirmar", "recusar"):
            return Response({"detail": "Ação inválida."}, status=status.HTTP_400_BAD_REQUEST)
        # Idempotente: só age enquanto estiver PENDENTE (evita re-disparar avisos).
        if consulta.status_confirmacao == Consulta.StatusConfirmacao.PENDENTE:
            aplicar_resposta(
                consulta,
                "CONFIRMA" if acao == "confirmar" else "RECUSA",
                connection.schema_name,
            )
            # Registra no histórico (sem template -> aparece como "Resposta").
            LogNotificacao.objects.create(
                consulta=consulta,
                direcao=LogNotificacao.Direcao.RECEBIDA,
                mensagem="Confirmou pelo link" if acao == "confirmar" else "Cancelou pelo link",
                resposta_paciente=acao,
                status=LogNotificacao.Status.RESPONDIDA,
                respondido_em=timezone.now(),
            )
        return Response({"status_confirmacao": consulta.status_confirmacao})


@csrf_exempt
def waha_webhook(request):
    """
    Recebe os eventos do WAHA (resposta do paciente). Resolve o tenant pela
    `session` do payload e registra a resposta no schema correto.

    Autenticação inbound: o endpoint é público via proxy, então exigimos um segredo
    compartilhado (`WAHA_WEBHOOK_TOKEN`) enviado pelo WAHA em `?token=` (ou no header
    `X-Webhook-Token`). Sem isso, um terceiro poderia forjar respostas e confirmar/
    cancelar consultas de qualquer clínica (o schema vem do corpo `session`).
    Quando `WAHA_WEBHOOK_TOKEN` está vazio (dev/piloto), a verificação é ignorada.
    """
    esperado = getattr(settings, "WAHA_WEBHOOK_TOKEN", "") or ""
    if esperado:
        recebido = request.GET.get("token") or request.headers.get("X-Webhook-Token") or ""
        if not hmac.compare_digest(str(recebido), str(esperado)):
            logger.warning("Webhook WAHA rejeitado: token ausente/inválido.")
            return HttpResponse(status=401)

    try:
        data = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return HttpResponse(status=400)

    if not isinstance(data, dict) or data.get("event") != "message":
        return HttpResponse(status=200)

    # `payload` pode chegar ausente OU explicitamente null (`"payload": null`);
    # `.get("payload", {})` só cobre o caso ausente, então normalizamos aqui para
    # nunca chamar `.get` em None (evita 500 e a tempestade de retries do WAHA).
    payload = data.get("payload") or {}
    if not isinstance(payload, dict):
        return HttpResponse(status=200)
    if payload.get("fromMe"):
        return HttpResponse(status=200)  # ignora o que nós mesmos enviamos

    try:
        schema = schema_da_sessao(data.get("session", ""))
        if schema:
            with schema_context(schema):
                registrar_resposta(schema, payload)
    except Exception:  # noqa: BLE001 — webhook público: nunca devolver 5xx (evita retry storm)
        logger.exception("Falha ao processar webhook WAHA (session=%s)", data.get("session"))

    return HttpResponse(status=200)
