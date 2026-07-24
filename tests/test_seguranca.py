"""Revisão de segurança: o checklist de deploy do Django deve ficar sem avisos."""

import os
import subprocess
import sys

from django.conf import settings
from django.core.management.utils import get_random_secret_key


def test_check_deploy_producao_sem_avisos():
    """`manage.py check --deploy` (settings de produção) não pode emitir avisos."""
    env = {
        **os.environ,
        "DJANGO_SETTINGS_MODULE": "config.settings.prod",
        "DJANGO_ALLOWED_HOSTS": "exemplo.com",
        "DJANGO_SECRET_KEY": get_random_secret_key(),
    }
    resultado = subprocess.run(
        [sys.executable, "manage.py", "check", "--deploy", "--fail-level", "WARNING"],
        env=env,
        capture_output=True,
        text=True,
        cwd=str(settings.BASE_DIR),
    )
    assert resultado.returncode == 0, resultado.stdout + resultado.stderr
