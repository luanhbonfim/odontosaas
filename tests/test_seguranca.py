"""Revisão de segurança: o checklist de deploy do Django deve ficar sem avisos."""

import os
import subprocess
import sys

from cryptography.fernet import Fernet
from django.conf import settings
from django.core.management.utils import get_random_secret_key


def test_check_deploy_producao_sem_avisos():
    """`manage.py check --deploy` (settings de produção) não pode emitir avisos."""
    # Produção agora falha-fechado sem segredos reais (SECRET_KEY/FIELD_ENCRYPTION_KEY),
    # então o cenário de prod do teste precisa fornecê-los.
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.prod",
        "DJANGO_ALLOWED_HOSTS": "exemplo.com",
        "DJANGO_SECRET_KEY": get_random_secret_key(),
        "FIELD_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        "WAHA_WEBHOOK_TOKEN": get_random_secret_key(),
    }
    resultado = subprocess.run(
        [sys.executable, "manage.py", "check", "--deploy", "--fail-level", "WARNING"],
        env=env,
        capture_output=True,
        text=True,
        cwd=str(settings.BASE_DIR),
    )
    assert resultado.returncode == 0, resultado.stdout + resultado.stderr


def _rodar_check_prod(**overrides):
    """Roda `manage.py check` num subprocesso com settings de prod — os
    fail-closed de segredos rodam na importação do settings, então precisam de
    um processo novo (não dá pra reimportar `config.settings.prod` no mesmo
    processo do pytest e ver o efeito)."""
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.prod",
        "DJANGO_ALLOWED_HOSTS": "exemplo.com",
        "DJANGO_SECRET_KEY": get_random_secret_key(),
        "FIELD_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        "WAHA_WEBHOOK_TOKEN": get_random_secret_key(),
        **overrides,
    }
    return subprocess.run(
        [sys.executable, "manage.py", "check"],
        env=env,
        capture_output=True,
        text=True,
        cwd=str(settings.BASE_DIR),
    )


def test_producao_recusa_subir_sem_waha_webhook_token():
    """Sem `WAHA_WEBHOOK_TOKEN`, o webhook do WhatsApp aceitaria qualquer POST
    sem autenticação (forjaria confirmação/cancelamento de qualquer clínica) —
    precisa falhar-fechado, igual a SECRET_KEY/FIELD_ENCRYPTION_KEY."""
    resultado = _rodar_check_prod(WAHA_WEBHOOK_TOKEN="")
    assert resultado.returncode != 0
    assert "WAHA_WEBHOOK_TOKEN" in resultado.stderr


def test_producao_recusa_secret_key_curta():
    resultado = _rodar_check_prod(DJANGO_SECRET_KEY="chave-curta-demais")
    assert resultado.returncode != 0
    assert "curta demais" in resultado.stderr
