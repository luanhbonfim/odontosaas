"""
Simulação de 'digitando…' por clínica (config `simular_digitacao`/`segundos_digitacao`).

Garante que o helper de envio respeita a preferência da clínica: com a simulação
ligada, mostra o presence de digitação pelo tempo configurado antes de enviar; com
ela desligada (ou 0s), envia direto.
"""

from types import SimpleNamespace
from unittest.mock import patch

# Captura a função REAL no import (o conftest no-opa `tasks._espacar_fila` via autouse,
# mas este binding local preserva a implementação original para testá-la).
from apps.notificacoes.tasks import _espacar_fila as _espacar_fila_real


def _config(**kw):
    base = {
        "waha_session": "sess",
        "simular_digitacao": True,
        "segundos_digitacao": 4,
        "intervalo_fila_segundos": 20,
    }
    base.update(kw)
    return SimpleNamespace(**base)


def test_espacar_fila_aguarda_o_intervalo_configurado():
    with patch("time.sleep") as sleep:
        _espacar_fila_real(_config(intervalo_fila_segundos=25))
    sleep.assert_called_once_with(25)


def test_espacar_fila_nao_aguarda_quando_zero():
    with patch("time.sleep") as sleep:
        _espacar_fila_real(_config(intervalo_fila_segundos=0))
    sleep.assert_not_called()


def test_enviar_simula_digitacao_quando_ligado():
    from apps.notificacoes import tasks

    with (
        patch.object(tasks, "enviar_digitando") as typ,
        patch.object(tasks, "enviar_texto", return_value={"id": "x"}) as env,
    ):
        tasks._enviar(_config(segundos_digitacao=7), "5518999999999", "oi")

    typ.assert_called_once_with("sess", "5518999999999", segundos=7)
    env.assert_called_once_with("sess", "5518999999999", "oi")


def test_enviar_pula_digitacao_quando_desligado():
    from apps.notificacoes import tasks

    with (
        patch.object(tasks, "enviar_digitando") as typ,
        patch.object(tasks, "enviar_texto", return_value={"id": "x"}) as env,
    ):
        tasks._enviar(_config(simular_digitacao=False), "5518999999999", "oi")

    typ.assert_not_called()
    env.assert_called_once()


def test_enviar_pula_digitacao_quando_zero_segundos():
    from apps.notificacoes import tasks

    with (
        patch.object(tasks, "enviar_digitando") as typ,
        patch.object(tasks, "enviar_texto", return_value={"id": "x"}) as env,
    ):
        tasks._enviar(_config(segundos_digitacao=0), "5518999999999", "oi")

    typ.assert_not_called()
    env.assert_called_once()
