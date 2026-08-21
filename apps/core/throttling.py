"""
Throttles (limites de taxa) para endpoints sensíveis.

As taxas ficam em `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` (settings), por escopo.
Aplicados por-view via `throttle_classes` — não são globais, para não afetar
os demais endpoints da API.
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class VendorLoginThrottle(AnonRateThrottle):
    """Login de operador do Vendor Admin (por IP). Defesa em profundidade sobre
    o lockout por força bruta já existente."""

    scope = "vendor_login"


class ImpersonateThrottle(UserRateThrottle):
    """Geração de token de suporte/impersonate (por operador autenticado)."""

    scope = "impersonate"


class StudioThrottle(UserRateThrottle):
    """Console SQL do Database Studio (por operador autenticado)."""

    scope = "studio"
