"""
Cliente HTTP do WAHA (WhatsApp HTTP API).

Funções finas sobre a REST do WAHA; a autenticação usa o header X-Api-Key.
"""

import base64

import requests
from django.conf import settings


def _base_url():
    return settings.WAHA_API_URL.rstrip("/")


def _headers():
    return {"X-Api-Key": settings.WAHA_API_KEY}


def normalizar_numero(numero):
    """Dígitos do número em formato internacional. Brasil: se vier só com DDD +
    número (10-11 dígitos), prefixa o DDI 55 (ex.: 18996902466 -> 5518996902466)."""
    digitos = "".join(ch for ch in str(numero) if ch.isdigit())
    if len(digitos) in (10, 11) and not digitos.startswith("55"):
        digitos = "55" + digitos
    return digitos


def numero_valido(numero):
    """Heurística: precisa de DDI+DDD+número (>= 12 dígitos após normalizar)."""
    return len(normalizar_numero(numero)) >= 12


def _chat_id(numero):
    """Converte um número em chatId do WhatsApp (normalizado + @c.us)."""
    return f"{normalizar_numero(numero)}@c.us"


def id_da_mensagem(resposta):
    """Extrai o ID da mensagem da resposta do WAHA (NOWEB devolve em key.id)."""
    if isinstance(resposta, dict):
        return (resposta.get("key") or {}).get("id") or resposta.get("id") or ""
    return ""


def enviar_digitando(session, numero, segundos=4, timeout=10):
    """Mostra 'digitando…' para o paciente por ~`segundos` antes de enviar.

    Best-effort: falhas são silenciosas — é só um efeito visual, não pode
    quebrar o envio. Segura o 'digitando' pelo tempo pedido (padrão 4s).
    """
    import contextlib
    import time

    with contextlib.suppress(requests.RequestException):
        requests.post(
            f"{_base_url()}/api/startTyping",
            json={"session": session, "chatId": _chat_id(numero)},
            headers=_headers(),
            timeout=timeout,
        )
        if segundos:
            time.sleep(segundos)


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


def _reiniciar_sessao(session, timeout=10):
    """Reinicia a sessão (POST /api/sessions/{s}/restart) — recupera FAILED."""
    resposta = requests.post(
        f"{_base_url()}/api/sessions/{session}/restart", headers=_headers(), timeout=timeout
    )
    return resposta.status_code in (200, 201)


# Estados em que a sessão já está utilizável (não precisa recriar/reiniciar).
_ESTADOS_OK = {"WORKING", "STARTING", "SCAN_QR_CODE"}


def garantir_sessao(session, timeout=10):
    """
    Garante que a sessão do WAHA exista e esteja pronta para parear/enviar.

    - Já em estado utilizável (WORKING/STARTING/SCAN_QR_CODE): nada a fazer.
    - FAILED (ex.: após reinício do WAHA/Docker): reinicia para voltar ao QR.
    - STOPPED/inexistente: cria e inicia; se já existir mas parada, reinicia.
    """
    status = (status_sessao(session, timeout=timeout) or {}).get("status")
    if status in _ESTADOS_OK:
        return True
    if status == "FAILED":
        return _reiniciar_sessao(session, timeout=timeout)

    resposta = requests.post(
        f"{_base_url()}/api/sessions",
        json={"name": session, "start": True},
        headers=_headers(),
        timeout=timeout,
    )
    if resposta.status_code in (200, 201):
        return True
    # Já existe mas não está iniciada (409/422): reinicia para provisionar.
    if resposta.status_code in (409, 422):
        return _reiniciar_sessao(session, timeout=timeout)
    return False


def status_sessao(session, timeout=10):
    """Estado da sessão no WAHA: {status, me}. 404 => tratada como STOPPED."""
    resposta = requests.get(
        f"{_base_url()}/api/sessions/{session}", headers=_headers(), timeout=timeout
    )
    if resposta.status_code == 404:
        return {"status": "STOPPED", "me": None}
    resposta.raise_for_status()
    return resposta.json()


def obter_qr(session, timeout=10):
    """QR de pareamento como data URI (PNG base64), para exibir no app."""
    resposta = requests.get(
        f"{_base_url()}/api/{session}/auth/qr",
        params={"format": "image"},
        headers=_headers(),
        timeout=timeout,
    )
    resposta.raise_for_status()
    b64 = base64.b64encode(resposta.content).decode()
    return f"data:image/png;base64,{b64}"


def encerrar_sessao(session, timeout=10):
    """Desconecta o WhatsApp da sessão (logout). Idempotente."""
    resposta = requests.post(
        f"{_base_url()}/api/sessions/{session}/logout", headers=_headers(), timeout=timeout
    )
    return resposta.status_code in (200, 201, 404, 422)
