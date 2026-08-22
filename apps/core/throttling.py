"""
Throttles (limites de taxa) para endpoints sensíveis.

As taxas vêm da configuração dinâmica do Vendor Admin (ConfiguracaoLoginVendor);
com fallback para `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` (settings) se a config
estiver ausente ou com formato inválido. Aplicados por-view via `throttle_classes`.
"""

import re

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

_FORMATO_RATE = re.compile(r"^\d+/(s|sec|second|m|min|minute|h|hour|d|day)$")


def _rate_dinamico(scope, fallback):
    """Lê a taxa do scope na configuração do vendor; valida o formato 'N/período'."""
    try:
        from apps.plataforma_admin.config import get_config

        valor = getattr(get_config(), f"throttle_{scope}", "") or ""
        if _FORMATO_RATE.match(valor.strip()):
            return valor.strip()
    except Exception:
        pass
    return fallback


class VendorLoginThrottle(AnonRateThrottle):
    """Login de operador do Vendor Admin (por IP). Defesa em profundidade sobre
    o lockout por força bruta já existente."""

    scope = "vendor_login"

    def get_rate(self):
        return _rate_dinamico("vendor_login", super().get_rate())


class ImpersonateThrottle(UserRateThrottle):
    """Geração de token de suporte/impersonate (por operador autenticado)."""

    scope = "impersonate"

    def get_rate(self):
        return _rate_dinamico("impersonate", super().get_rate())


class StudioThrottle(UserRateThrottle):
    """Console SQL do Database Studio (por operador autenticado)."""

    scope = "studio"

    def get_rate(self):
        return _rate_dinamico("studio", super().get_rate())
