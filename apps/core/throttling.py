"""
Throttles (limites de taxa) para endpoints sensíveis.

As taxas vêm da configuração dinâmica do Vendor Admin (ConfiguracaoLoginVendor);
com fallback para `REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"]` (settings) se a config
estiver ausente ou com formato inválido. Aplicados por-view via `throttle_classes`.
"""

import re

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

# Numerador >= 1 (sem zero/zeros à esquerda): "0/min" faria o DRF barrar TODAS as
# requisições (num_requests=0 => len(history) >= 0 sempre verdadeiro), derrubando o
# login do painel de forma irreversível pela própria API. Teto evita desligar a defesa.
_FORMATO_RATE = re.compile(r"^([1-9]\d*)/(s|sec|second|m|min|minute|h|hour|d|day)$")


def _rate_dinamico(scope, fallback):
    """Lê a taxa do scope na configuração do vendor; valida o formato 'N/período'
    (N entre 1 e 10000). Qualquer valor fora disso cai no fallback dos settings."""
    try:
        from apps.plataforma_admin.config import get_config

        valor = (getattr(get_config(), f"throttle_{scope}", "") or "").strip()
        m = _FORMATO_RATE.match(valor)
        if m and 1 <= int(m.group(1)) <= 10000:
            return valor
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
