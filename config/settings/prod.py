"""
Configurações de PRODUÇÃO.
Herdam de base.py e reforçam segurança. Espera variáveis de ambiente reais.
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F401,F403

DEBUG = False

# --------------------------------------------------------------------------
# Fail-closed dos segredos críticos em produção.
# Os defaults de `base.py` existem só para dev/CI. Se o operador esquecer de
# definir estas variáveis, o processo NÃO deve subir com chaves públicas
# (SECRET_KEY → forja de JWT/sessão; FIELD_ENCRYPTION_KEY → tokens Google do
# banco viram texto decifrável por qualquer um com acesso ao repo).
# --------------------------------------------------------------------------
_SECRET_KEY_DEV = "unsafe-dev-key-troque-me"
_FERNET_KEY_DEV = "7bfL4XTjSO_rOvwylRpwinUaaB-e2N_Q4mQG2eV8-68="

if not SECRET_KEY or SECRET_KEY == _SECRET_KEY_DEV:  # noqa: F405
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY é obrigatória em produção (o default de desenvolvimento é inseguro/público)."
    )
if not FIELD_ENCRYPTION_KEY or FIELD_ENCRYPTION_KEY == _FERNET_KEY_DEV:  # noqa: F405
    raise ImproperlyConfigured(
        "FIELD_ENCRYPTION_KEY é obrigatória em produção (o default de desenvolvimento é inseguro/público)."
    )

# Em produção, ALLOWED_HOSTS deve vir OBRIGATORIAMENTE do ambiente.
# Dica multi-tenant: use ".seudominio.com.br" (ponto na frente) para casar
# TODOS os subdomínios de clínica de uma vez.
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")  # noqa: F405

# Origens confiáveis para CSRF (admin do Django atrás de HTTPS). Aceita curinga
# de subdomínio: ex.: "https://*.seudominio.com.br".
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])  # noqa: F405

# --------------------------------------------------------------------------
# Segurança HTTPS
# --------------------------------------------------------------------------
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = env.bool("DJANGO_SECURE_SSL_REDIRECT", default=True)  # noqa: F405
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 60 * 60 * 24 * 365  # 1 ano
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# --------------------------------------------------------------------------
# Arquivos estáticos servidos pelo WhiteNoise
# --------------------------------------------------------------------------
MIDDLEWARE = list(MIDDLEWARE)
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")  # noqa: F405

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# --------------------------------------------------------------------------
# Hardening de produção
# --------------------------------------------------------------------------
# Atrás do Caddy (1 proxy): faz o DRF resolver o IP real do cliente (último hop
# do X-Forwarded-For) para a identidade dos throttles.
REST_FRAMEWORK = {**REST_FRAMEWORK, "NUM_PROXIES": 1}  # noqa: F405

# Swagger/ReDoc e o schema OpenAPI ficam restritos a staff em produção
# (não expõem o mapa completo da API para anônimos).
SPECTACULAR_SETTINGS = {  # noqa: F405
    **SPECTACULAR_SETTINGS,  # noqa: F405
    "SERVE_PERMISSIONS": ["rest_framework.permissions.IsAdminUser"],
}
