"""
Acesso em cache às Configurações de Login & Sessão (singleton no schema public).

Usado no caminho de login (lockout, tokens, 2FA), no impersonate e nos throttles
(que rodam a cada requisição). Cache curto (30s) para não consultar o banco a cada
request; invalidado explicitamente ao salvar a configuração.
"""

from django.core.cache import cache

CACHE_KEY = "vendor_login_config_v1"
CACHE_TIMEOUT = 30  # segundos


def get_config():
    """Retorna o singleton de configuração (com cache de 30s)."""
    obj = cache.get(CACHE_KEY)
    if obj is None:
        from apps.plataforma_admin.models import ConfiguracaoLoginVendor

        obj = ConfiguracaoLoginVendor.get_solo()
        cache.set(CACHE_KEY, obj, timeout=CACHE_TIMEOUT)
    return obj


def limpar_cache_config():
    """Invalida o cache — chamar após salvar a configuração."""
    cache.delete(CACHE_KEY)
