"""
Simulação de 'digitando…' por clínica (config `simular_digitacao`/`segundos_digitacao`).

Garante que o helper de envio respeita a preferência da clínica: com a simulação
ligada, mostra o presence de digitação pelo tempo configurado antes de enviar; com
ela desligada (ou 0s), envia direto.
"""

from types import SimpleNamespace
from unittest.mock import patch


def _config(**kw):
    base = {"waha_session": "sess", "simular_digitacao": True, "segundos_digitacao": 4}
    base.update(kw)
    return SimpleNamespace(**base)


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
