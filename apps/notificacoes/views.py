"""Views do app notificacoes (API REST + webhook do WAHA)."""

import json

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django_tenants.utils import schema_context
from rest_framework import viewsets

from .inbound import registrar_resposta, schema_da_sessao
from .models import ConfiguracaoNotificacao, TemplateMensagem
from .serializers import ConfiguracaoNotificacaoSerializer, TemplateMensagemSerializer


class ConfiguracaoNotificacaoViewSet(viewsets.ModelViewSet):
    """Personalização das notificações da clínica (antecedência, sessão WAHA)."""

    queryset = ConfiguracaoNotificacao.objects.all()
    serializer_class = ConfiguracaoNotificacaoSerializer


class TemplateMensagemViewSet(viewsets.ModelViewSet):
    """CRUD dos templates de mensagem."""

    queryset = TemplateMensagem.objects.all()
    serializer_class = TemplateMensagemSerializer


@csrf_exempt
def waha_webhook(request):
    """
    Recebe os eventos do WAHA (resposta do paciente). Resolve o tenant pela
    `session` do payload e registra a resposta no schema correto.
    """
    try:
        data = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return HttpResponse(status=400)

    if data.get("event") != "message":
        return HttpResponse(status=200)

    payload = data.get("payload", {})
    if payload.get("fromMe"):
        return HttpResponse(status=200)  # ignora o que nós mesmos enviamos

    schema = schema_da_sessao(data.get("session", ""))
    if schema:
        with schema_context(schema):
            registrar_resposta(schema, payload)

    return HttpResponse(status=200)
