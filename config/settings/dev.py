"""
Configurações de DESENVOLVIMENTO.
Herdam de base.py e afrouxam restrições para o dia a dia local.
"""

from .base import *  # noqa: F401,F403

DEBUG = True

# Em desenvolvimento aceitamos os hosts locais e subdomínios de tenant (*.localhost).
# "web" é o nome do serviço na rede do docker-compose (usado pelo webhook do WAHA).
ALLOWED_HOSTS = ["localhost", "127.0.0.1", ".localhost", "0.0.0.0", "web"]

# E-mails vão para o console em vez de um servidor SMTP real.
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
