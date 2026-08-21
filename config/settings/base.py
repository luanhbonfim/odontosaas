"""
Configurações BASE do OdontoSaaS.

Compartilhadas por todos os ambientes. Os módulos `dev.py` e `prod.py`
importam deste arquivo (`from .base import *`) e sobrescrevem o necessário.

Multi-tenant via django-tenants (schema-per-tenant): SHARED_APPS no schema
`public`, TENANT_APPS em cada schema de clínica. O Celery é configurado
adiante na Sprint 1.
"""

from datetime import timedelta
from pathlib import Path

import environ

# BASE_DIR = raiz do repositório (onde vive o manage.py):
# base.py -> settings/ -> config/ -> raiz
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# --------------------------------------------------------------------------
# Leitura de variáveis de ambiente (.env)
# --------------------------------------------------------------------------
env = environ.Env(
    DJANGO_DEBUG=(bool, False),
)
# Carrega o .env da raiz, se existir (em produção usam-se variáveis reais).
environ.Env.read_env(BASE_DIR / ".env")

# --------------------------------------------------------------------------
# Segurança
# --------------------------------------------------------------------------
SECRET_KEY = env("DJANGO_SECRET_KEY", default="unsafe-dev-key-troque-me")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# Chave Fernet para criptografar campos sensíveis (tokens do Google).
# O default é apenas para dev/CI — em PRODUÇÃO defina FIELD_ENCRYPTION_KEY no ambiente.
FIELD_ENCRYPTION_KEY = env(
    "FIELD_ENCRYPTION_KEY",
    default="7bfL4XTjSO_rOvwylRpwinUaaB-e2N_Q4mQG2eV8-68=",
)

# Silencia avisos cosméticos de geração de schema OpenAPI no system check
SILENCED_SYSTEM_CHECKS = ["drf_spectacular.W001", "drf_spectacular.W002", "drf_spectacular.W003"]

# --------------------------------------------------------------------------
# Aplicações (django-tenants)
#   SHARED_APPS  -> schema `public` (dados da plataforma, comuns a todas)
#   TENANT_APPS  -> schema de cada clínica (dados isolados por tenant)
# --------------------------------------------------------------------------
SHARED_APPS = [
    "django_tenants",  # obrigatório e primeiro
    "apps.core",  # abstrações compartilhadas (ModeloBase)
    "apps.tenants",  # model do tenant (Clinica) e de domínio (Dominio)
    "apps.plataforma",  # planos de assinatura do SaaS
    "apps.plataforma_admin",  # governança e administração da plataforma (Vendor Admin)
    "django_celery_beat",  # agenda global de tarefas periódicas (schema public)
    "drf_spectacular",  # documentação de API (OpenAPI / Swagger / ReDoc)
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
]

TENANT_APPS = [
    "django.contrib.auth",
    "apps.usuarios",  # Usuario custom (AUTH_USER_MODEL)
    "django.contrib.admin",
    "django.contrib.sessions",
    "django.contrib.messages",
    "rest_framework",
    "apps.dentistas",  # gestão de dentistas (Sprint 2)
    "apps.convenios",  # catálogo de convênios da clínica (Sprint 3.6)
    "apps.procedimentos",  # catálogo de procedimentos + recall (Sprint 10)
    "apps.pacientes",  # gestão de pacientes (Sprint 3)
    "apps.agenda",  # agenda / atendimento (Sprint 4)
    "apps.integracoes",  # integrações externas (Google Calendar) (Sprint 5)
    "apps.notificacoes",  # notificações WhatsApp / WAHA (Sprint 6)
    "apps.estoque",  # gestão de insumos / estoque (Sprint 7)
    "apps.financeiro",  # gestão financeira (Sprint 8)
    "apps.auditoria",  # trilha de auditoria / LGPD (Sprint 9)
]

# INSTALLED_APPS = SHARED + (TENANT que ainda não esteja em SHARED)
INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]

# Model de usuário customizado (login por e-mail), vive no schema do tenant.
AUTH_USER_MODEL = "usuarios.Usuario"

# --------------------------------------------------------------------------
# Django REST Framework + documentação de API (drf-spectacular / OpenAPI)
# --------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Autenticação por JWT (Bearer) compatível com multi-tenancy e schema public.
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.usuarios.authentication.MultiTenantJWTAuthentication",
    ],
    # Por padrão: autenticado + permissão de model por perfil (grupos do Django).
    # Views sem model (ex.: /api/auth/me/) exigem só autenticação (ver PermissaoModulo).
    "DEFAULT_PERMISSION_CLASSES": [
        "apps.usuarios.perfis.PermissaoModulo",
    ],
    # Captura automática de exceções e registro de erros operacionais no Vendor Admin
    "EXCEPTION_HANDLER": "apps.core.handlers.custom_exception_handler",
    # Taxas dos throttles por-escopo (aplicados só nos endpoints sensíveis via
    # throttle_classes — ver apps/core/throttling.py). Ajustáveis por ambiente.
    "DEFAULT_THROTTLE_RATES": {
        "vendor_login": env("THROTTLE_VENDOR_LOGIN", default="30/min"),  # noqa: F405
        "impersonate": env("THROTTLE_IMPERSONATE", default="30/min"),  # noqa: F405
        "studio": env("THROTTLE_STUDIO", default="60/min"),  # noqa: F405
    },
}

# Tokens JWT (djangorestframework-simplejwt).
# Sessão de 24h a partir do login: o refresh vale 1 dia; o access (curto) é
# renovado automaticamente pelo frontend enquanto o refresh estiver válido.
# Após 24h o refresh expira e o login é encerrado (exige novo login).
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(hours=24),
}

# --------------------------------------------------------------------------
# Cache (Redis) — compartilhado entre workers. Usado, entre outros, pelo
# contador de tentativas de login (bloqueio por força bruta em LoginView).
# --------------------------------------------------------------------------
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_CACHE_URL", default="redis://redis:6379/2"),
    }
}

SPECTACULAR_SETTINGS = {
    "TITLE": "OdontoSaaS API",
    "DESCRIPTION": "API do sistema multi-tenant de gestão de clínicas odontológicas.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # O schema e o Swagger/ReDoc ficam públicos (facilita a integração do frontend).
    "SERVE_PERMISSIONS": ["rest_framework.permissions.AllowAny"],
}

# --------------------------------------------------------------------------
# Middleware
# --------------------------------------------------------------------------
MIDDLEWARE = [
    # Responde /health/ ANTES da resolução de tenant (healthcheck robusto,
    # independe de tenant/migrations).
    "config.middleware.HealthCheckMiddleware",
    # Resolve o tenant a partir do domínio da requisição (deve vir cedo).
    "django_tenants.middleware.main.TenantMainMiddleware",
    # Intercepta e bloqueia clínicas inativas ou inadimplentes (403 Forbidden).
    "config.middleware.TenantStatusMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    # Captura o usuário autenticado para a trilha de auditoria (após o auth).
    "apps.auditoria.middleware.AuditoriaMiddleware",
    # Bloqueia mutações (POST/PUT/PATCH/DELETE) em sessões de suporte read-only.
    "config.middleware.ImpersonateReadOnlyMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

# --------------------------------------------------------------------------
# Templates
# --------------------------------------------------------------------------
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# --------------------------------------------------------------------------
# Banco de dados (PostgreSQL 16 + django-tenants)
# --------------------------------------------------------------------------
DATABASES = {
    "default": {
        **env.db(
            "DATABASE_URL",
            default="postgres://odonto:odonto@localhost:5432/odonto",
        ),
        # Engine multi-tenant (schema-per-tenant).
        "ENGINE": "django_tenants.postgresql_backend",
    }
}

# Roteia migrações/queries entre o schema public (SHARED) e os de tenant.
DATABASE_ROUTERS = ["django_tenants.routers.TenantSyncRouter"]

# Models que representam o tenant (clínica) e seus domínios.
TENANT_MODEL = "tenants.Clinica"
TENANT_DOMAIN_MODEL = "tenants.Dominio"

# --------------------------------------------------------------------------
# Celery (broker/result no Redis) + agendador no banco (django-celery-beat)
# --------------------------------------------------------------------------
CELERY_BROKER_URL = env("CELERY_BROKER_URL", default="redis://redis:6379/0")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND", default="redis://redis:6379/1")
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = "America/Sao_Paulo"  # espelha TIME_ZONE (definido abaixo)
# Agenda periódica persistida no banco (permite configurar por clínica sem redeploy).
CELERY_BEAT_SCHEDULER = "django_celery_beat.schedulers:DatabaseScheduler"

# Agenda de tarefas periódicas gerenciada 100% dinamicamente via django-celery-beat (banco de dados).
# Mantido vazio para impedir que o DatabaseScheduler sobrescreva alterações de intervalo/cron
# feitas em runtime pelos operadores do vendor através do painel administrativo.
CELERY_BEAT_SCHEDULE = {}


# --------------------------------------------------------------------------
# Google Calendar (OAuth2)
# --------------------------------------------------------------------------
GOOGLE_OAUTH_CLIENT_ID = env("GOOGLE_OAUTH_CLIENT_ID", default="")
GOOGLE_OAUTH_CLIENT_SECRET = env("GOOGLE_OAUTH_CLIENT_SECRET", default="")
GOOGLE_OAUTH_REDIRECT_URI = env(
    "GOOGLE_OAUTH_REDIRECT_URI",
    default="http://localhost:8000/integracoes/google/callback",
)
# Base do frontend (SPA) para onde o callback OAuth volta. Vazio = redirect
# relativo (produção same-origin). Em dev, aponte para o Vite (ex.: http://demo.localhost:5173).
GOOGLE_OAUTH_FRONTEND_URL = env("GOOGLE_OAUTH_FRONTEND_URL", default="")
# Base pública do app para montar links (ex.: link de confirmação por WhatsApp).
# Vazio = usa o domínio primário do tenant. Em dev, aponte para o Vite.
APP_BASE_URL = env("APP_BASE_URL", default="")

# --------------------------------------------------------------------------
# WAHA (WhatsApp HTTP API)
# --------------------------------------------------------------------------
WAHA_API_URL = env("WAHA_API_URL", default="http://waha:3000")
WAHA_API_KEY = env("WAHA_API_KEY", default="")
# Segredo compartilhado que autentica o webhook INBOUND do WAHA (WAHA -> Django).
# Quando definido, o endpoint /notificacoes/whatsapp/webhook exige `?token=<este valor>`
# (a mesma variável monta a WHATSAPP_HOOK_URL do container WAHA — ver docker-compose.prod
# e .env.prod.example). Vazio = sem verificação (apenas dev; em produção defina sempre).
WAHA_WEBHOOK_TOKEN = env("WAHA_WEBHOOK_TOKEN", default="")

# --------------------------------------------------------------------------
# Validação de senhas
# --------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# --------------------------------------------------------------------------
# Internacionalização
# --------------------------------------------------------------------------
LANGUAGE_CODE = "pt-br"
TIME_ZONE = "America/Sao_Paulo"
USE_I18N = True
USE_TZ = True

# --------------------------------------------------------------------------
# Arquivos estáticos e de mídia
# --------------------------------------------------------------------------
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# --------------------------------------------------------------------------
# Outras configurações
# --------------------------------------------------------------------------
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --------------------------------------------------------------------------
# Observabilidade — logs estruturados (JSON) + Sentry opcional
# --------------------------------------------------------------------------
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {"()": "config.logging.JsonFormatter"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "json"},
    },
    "root": {
        "handlers": ["console"],
        "level": env("DJANGO_LOG_LEVEL", default="INFO"),
    },
}

# Sentry só é ativado se SENTRY_DSN for definido e o pacote sentry-sdk existir.
SENTRY_DSN = env("SENTRY_DSN", default="")
if SENTRY_DSN:
    from config.observabilidade import configurar_sentry

    configurar_sentry(SENTRY_DSN)
