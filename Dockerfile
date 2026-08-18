# syntax=docker/dockerfile:1
# ==========================================================================
# OdontoSaaS — Dockerfile da aplicação Django (multi-stage, usuário não-root)
# Build padrão (produção):   docker build -t odonto-web .
# Build com deps de dev:     docker build --build-arg REQUIREMENTS=dev -t odonto-web:dev .
# ==========================================================================

# --------------------------------------------------------------------------
# Stage 1: builder — instala dependências num virtualenv isolado
# --------------------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Toolchain para compilar dependências nativas (psycopg, cryptography, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Virtualenv isolado que será copiado para o runtime
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# Qual conjunto de dependências instalar: prod (padrão) ou dev
ARG REQUIREMENTS=prod
COPY requirements/ requirements/
RUN pip install --upgrade pip && \
    pip install -r requirements/${REQUIREMENTS}.txt

# --------------------------------------------------------------------------
# Stage 2: runtime — imagem final enxuta e não-root
# --------------------------------------------------------------------------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    DJANGO_SETTINGS_MODULE=config.settings.prod

# Cliente do PostgreSQL em runtime: libpq5 (psycopg) + postgresql-client (pg_dump,
# usado pela rotina de backup por schema — comando backup_tenant).
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Usuário e grupo de sistema não-root
RUN groupadd --system django && \
    useradd --system --gid django --home-dir /app --shell /usr/sbin/nologin django

WORKDIR /app

# Copia o virtualenv já montado no builder
COPY --from=builder /opt/venv /opt/venv

# Copia o código da aplicação com dono correto
COPY --chown=django:django . .

# Pastas de estáticos/mídia com dono `django`. Assim, ao montar um volume nomeado
# nesses caminhos, ele herda a permissão do usuário (senão o collectstatic, que
# roda como `django`, bate em Permission denied no volume criado como root).
RUN mkdir -p /app/staticfiles /app/media && chown -R django:django /app/staticfiles /app/media

# Executa como usuário sem privilégios
USER django

EXPOSE 8000

# Verificação de saúde apontando para o endpoint /health/ do Django
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request, sys; \
sys.exit(0) if urllib.request.urlopen('http://localhost:8000/health/', timeout=4).status == 200 else sys.exit(1)"

# Servidor de produção (WSGI)
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "60"]
