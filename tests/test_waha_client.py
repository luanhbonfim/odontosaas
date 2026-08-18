"""Testes do cliente HTTP do WAHA (mock HTTP via responses)."""

import json

import pytest
import responses
from django.conf import settings
from requests import HTTPError

from apps.notificacoes.waha import enviar_texto, garantir_sessao


def test_chat_id_normaliza():
    from apps.notificacoes.waha import _chat_id

    assert _chat_id("+55 (11) 98888-7777") == "5511988887777@c.us"


@responses.activate
def test_enviar_texto():
    url = f"{settings.WAHA_API_URL}/api/sendText"
    responses.add(responses.POST, url, json={"id": "msg-1"}, status=201)

    resultado = enviar_texto("clinica-x", "55 11 98888-7777", "Olá, tudo bem?")

    assert resultado["id"] == "msg-1"
    corpo = json.loads(responses.calls[0].request.body)
    assert corpo["session"] == "clinica-x"
    assert corpo["chatId"] == "5511988887777@c.us"
    assert corpo["text"] == "Olá, tudo bem?"
    assert responses.calls[0].request.headers["X-Api-Key"] == settings.WAHA_API_KEY


@responses.activate
def test_enviar_texto_erro_http():
    url = f"{settings.WAHA_API_URL}/api/sendText"
    responses.add(responses.POST, url, status=500)
    with pytest.raises(HTTPError):
        enviar_texto("s", "11999998888", "x")


@responses.activate
def test_garantir_sessao_cria():
    # Sessão inexistente (404 -> STOPPED) -> cria e inicia.
    responses.add(responses.GET, f"{settings.WAHA_API_URL}/api/sessions/s", status=404)
    responses.add(responses.POST, f"{settings.WAHA_API_URL}/api/sessions", json={"name": "s"}, status=201)
    assert garantir_sessao("s") is True


@responses.activate
def test_garantir_sessao_ja_pronta():
    # Já em estado utilizável: nada a fazer (sem POST).
    responses.add(
        responses.GET,
        f"{settings.WAHA_API_URL}/api/sessions/s",
        json={"status": "WORKING"},
        status=200,
    )
    assert garantir_sessao("s") is True


@responses.activate
def test_garantir_sessao_failed_reinicia():
    # Sessão FAILED (ex.: após reinício do WAHA) -> reinicia para voltar ao QR.
    responses.add(
        responses.GET,
        f"{settings.WAHA_API_URL}/api/sessions/s",
        json={"status": "FAILED"},
        status=200,
    )
    responses.add(responses.POST, f"{settings.WAHA_API_URL}/api/sessions/s/restart", status=201)
    assert garantir_sessao("s") is True


@responses.activate
def test_garantir_sessao_parada_reinicia():
    # Existe mas parada: POST /api/sessions devolve 422 -> reinicia.
    responses.add(
        responses.GET,
        f"{settings.WAHA_API_URL}/api/sessions/s",
        json={"status": "STOPPED"},
        status=200,
    )
    responses.add(responses.POST, f"{settings.WAHA_API_URL}/api/sessions", status=422)
    responses.add(responses.POST, f"{settings.WAHA_API_URL}/api/sessions/s/restart", status=201)
    assert garantir_sessao("s") is True
