"""
Captura do usuário da requisição para a auditoria.

Os signals de auditoria rodam fora do ciclo de request (não têm acesso ao
`request`), então guardamos o usuário autenticado num thread-local por requisição.
"""

import threading

_estado = threading.local()


def usuario_atual():
    """Usuário autenticado da requisição corrente (ou None)."""
    return getattr(_estado, "usuario", None)


class AuditoriaMiddleware:
    """Guarda o usuário autenticado no thread-local durante a requisição."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        usuario = getattr(request, "user", None)
        # Só guarda usuários autenticados E persistidos (com pk) — a FK da auditoria
        # aponta para um Usuario real.
        autenticado = getattr(usuario, "is_authenticated", False)
        _estado.usuario = usuario if (autenticado and getattr(usuario, "pk", None)) else None
        try:
            return self.get_response(request)
        finally:
            _estado.usuario = None
