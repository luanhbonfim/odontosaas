"""Testes de observabilidade: health endpoints, logs JSON e Sentry opcional."""

import json
import logging
import sys
import types
from unittest.mock import MagicMock, patch

import pytest
from django.test import Client

from config.logging import JsonFormatter
from config.observabilidade import configurar_sentry


# --- Health endpoints (via middleware, antes da resolução de tenant) ---
def test_health_liveness():
    resp = Client().get("/health/")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.django_db
def test_health_readiness_ok():
    resp = Client().get("/health/ready/")
    assert resp.status_code == 200
    assert resp.json()["db"] == "ok"


def test_health_readiness_db_erro():
    with patch("config.middleware.connection.cursor", side_effect=Exception("db down")):
        resp = Client().get("/health/ready/")
    assert resp.status_code == 503
    assert resp.json()["status"] == "erro"


# --- Log estruturado (JSON) ---
def test_json_formatter_mensagem():
    registro = logging.LogRecord(
        name="teste",
        level=logging.INFO,
        pathname="x.py",
        lineno=1,
        msg="ola %s",
        args=("mundo",),
        exc_info=None,
    )
    dados = json.loads(JsonFormatter().format(registro))
    assert dados["nivel"] == "INFO"
    assert dados["logger"] == "teste"
    assert dados["mensagem"] == "ola mundo"


def test_json_formatter_excecao():
    try:
        raise ValueError("falhou")
    except ValueError:
        registro = logging.LogRecord(
            name="teste",
            level=logging.ERROR,
            pathname="x.py",
            lineno=1,
            msg="erro",
            args=(),
            exc_info=sys.exc_info(),
        )
    dados = json.loads(JsonFormatter().format(registro))
    assert "excecao" in dados and "ValueError" in dados["excecao"]


# --- Sentry opcional ---
def test_configurar_sentry_sem_dsn():
    assert configurar_sentry("") is False


def test_configurar_sentry_sem_pacote():
    # sentry-sdk não está instalado no ambiente -> ImportError -> desativado
    assert configurar_sentry("https://x@exemplo.com/1") is False


def test_configurar_sentry_com_pacote():
    fake = types.ModuleType("sentry_sdk")
    fake.init = MagicMock()
    with patch.dict(sys.modules, {"sentry_sdk": fake}):
        assert configurar_sentry("https://x@exemplo.com/1") is True
    fake.init.assert_called_once()
