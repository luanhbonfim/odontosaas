"""
Configurações BASE do OdontoSaaS.

Compartilhadas por todos os ambientes. Os módulos `dev.py` e `prod.py`
importam deste arquivo (`from .base import *`) e sobrescrevem o necessário.

Multi-tenant via django-tenants (schema-per-tenant): SHARED_APPS no schema
`public`, TENANT_APPS em cada schema de clínica. O Celery é configurado
adiante na Sprint 1.
"""

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
    "django_celery_beat",  # agenda global de tarefas periódicas (schema public)
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
    "apps.pacientes",  # gestão de pacientes (Sprint 3)
    "apps.agenda",  # agenda / atendimento (Sprint 4)
    "apps.integracoes",  # integrações externas (Google Calendar) (Sprint 5)
    "apps.notificacoes",  # notificações WhatsApp / WAHA (Sprint 6)
    "apps.estoque",  # gestão de insumos / estoque (Sprint 7)
    # Demais apps de negócio (financeiro) entram nas próximas sprints.
]

# INSTALLED_APPS = SHARED + (TENANT que ainda não esteja em SHARED)
INSTALLED_APPS = list(SHARED_APPS) + [app for app in TENANT_APPS if app not in SHARED_APPS]

# Model de usuário customizado (login por e-mail), vive no schema do tenant.
AUTH_USER_MODEL = "usuarios.Usuario"

# --------------------------------------------------------------------------
# Middleware
# --------------------------------------------------------------------------
MIDDLEWARE = [
    # Responde /health/ ANTES da resolução de tenant (healthcheck robusto,
    # independe de tenant/migrations).
    "config.middleware.HealthCheckMiddleware",
    # Resolve o tenant a partir do domínio da requisição (deve vir cedo).
    "django_tenants.middleware.main.TenantMainMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
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

# Agenda padrão (o DatabaseScheduler sincroniza estas entradas para o banco).
CELERY_BEAT_SCHEDULE = {
    "sincronizar-google-incremental": {
        "task": "apps.integracoes.tasks.sincronizar_incremental_todos_tenants",
        "schedule": 900.0,  # a cada 15 minutos
    },
    "disparar-lembretes-whatsapp": {
        "task": "apps.notificacoes.tasks.disparar_lembretes_todos_tenants",
        "schedule": 3600.0,  # de hora em hora (varre a janela de antecedência)
    },
}

# --------------------------------------------------------------------------
# Google Calendar (OAuth2)
# --------------------------------------------------------------------------
GOOGLE_OAUTH_CLIENT_ID = env("GOOGLE_OAUTH_CLIENT_ID", default="")
GOOGLE_OAUTH_CLIENT_SECRET = env("GOOGLE_OAUTH_CLIENT_SECRET", default="")
GOOGLE_OAUTH_REDIRECT_URI = env(
    "GOOGLE_OAUTH_REDIRECT_URI",
    default="http://localhost:8000/integracoes/google/callback",
)

# --------------------------------------------------------------------------
# WAHA (WhatsApp HTTP API)
# --------------------------------------------------------------------------
WAHA_API_URL = env("WAHA_API_URL", default="http://waha:3000")
WAHA_API_KEY = env("WAHA_API_KEY", default="")

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
