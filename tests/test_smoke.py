"""
Testes de fumaça do OdontoSaaS.

Garantem que o projeto Django inicializa, serve o endpoint de saúde e
consegue falar com o banco de dados (Postgres) no ambiente de CI.
Testes de regra de negócio chegam a partir da Sprint 1.
"""

import pytest
from django.contrib.auth import get_user_model


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
    """Cria e consulta um registro — valida a conexão real com o Postgres."""
    user_model = get_user_model()
    user_model.objects.create_user(username="dr.teste", password="senha-forte-123")
    assert user_model.objects.filter(username="dr.teste").exists()
