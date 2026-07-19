"""
Configurações de DESENVOLVIMENTO.
Herdam de base.py e afrouxam restrições para o dia a dia local.
"""

from .base import *  # noqa: F401,F403

DEBUG = True

# Em desenvolvimento aceitamos os hosts locais e subdomínios de tenant (*.localhost).
ALLOWED_HOSTS = ["localhost", "127.0.0.1", ".localhost", "0.0.0.0"]

# E-mails vão para o console em vez de um servidor SMTP real.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
