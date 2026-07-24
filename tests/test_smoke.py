"""
Testes de fumaça do OdontoSaaS.

Garantem que o projeto Django inicializa, serve o endpoint de saúde e
consegue falar com o banco de dados (Postgres) no ambiente de CI.
"""

import pytest
from django.db import connection

from config.middleware import HealthCheckMiddleware


def test_health_endpoint_ok(client):
    """O endpoint /health/ responde 200 com o payload esperado."""
    resp = client.get("/health/")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_timezone_configurado(settings):
    """Configuração regional pt-BR / America/Sao_Paulo carregada."""
    assert settings.TIME_ZONE == "America/Sao_Paulo"
    assert settings.LANGUAGE_CODE == "pt-br"


@pytest.mark.django_db
def test_banco_de_dados_disponivel():
    """Valida a conexão real com o Postgres (schema público)."""
    with connection.cursor() as cur:
        cur.execute("SELECT 1")
        assert cur.fetchone() == (1,)


def test_urlconf_tem_admin():
    """A URLconf raiz carrega e roteia o admin."""
    from django.urls import reverse

    assert reverse("admin:login")


def test_healthcheck_middleware_curto_circuita():
    """O middleware responde /health/ e repassa as demais rotas."""
    sentinel = object()
    mw = HealthCheckMiddleware(lambda request: sentinel)

    class _ReqOutro:
        path = "/outra-rota/"

    assert mw(_ReqOutro()) is sentinel

    class _ReqHealth:
        path = "/health/"

    resp = mw(_ReqHealth())
    assert resp.status_code == 200
