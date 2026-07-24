"""
Cliente HTTP do WAHA (WhatsApp HTTP API).

Funções finas sobre a REST do WAHA; a autenticação usa o header X-Api-Key.
"""

import requests
from django.conf import settings


def _base_url():
    return settings.WAHA_API_URL.rstrip("/")


def _headers():
    return {"X-Api-Key": settings.WAHA_API_KEY}


def _chat_id(numero):
    """Converte um número em chatId do WhatsApp (apenas dígitos + @c.us)."""
    digitos = "".join(ch for ch in str(numero) if ch.isdigit())
    return f"{digitos}@c.us"


def id_da_mensagem(resposta):
    """Extrai o ID da mensagem da resposta do WAHA (NOWEB devolve em key.id)."""
    if isinstance(resposta, dict):
        return (resposta.get("key") or {}).get("id") or resposta.get("id") or ""
    return ""


def enviar_texto(session, numero, texto, timeout=10):
    """Envia uma mensagem de texto via WAHA (POST /api/sendText)."""
    resposta = requests.post(
        f"{_base_url()}/api/sendText",
        json={"session": session, "chatId": _chat_id(numero), "text": texto},
        headers=_headers(),
        timeout=timeout,
    )
    resposta.raise_for_status()
    return resposta.json()


def garantir_sessao(session, timeout=10):
    """
    Garante que a sessão do WAHA exista e esteja iniciada (POST /api/sessions).
    Se a sessão já existir, o WAHA responde 4xx — tratado como já provisionada.
    """
    resposta = requests.post(
        f"{_base_url()}/api/sessions",
        json={"name": session, "start": True},
        headers=_headers(),
        timeout=timeout,
    )
    return resposta.status_code in (200, 201, 409, 422)
