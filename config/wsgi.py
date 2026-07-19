"""
Configuração WSGI do OdontoSaaS.
Expõe o callable WSGI como a variável `application`.
"""

import os

from django.core.wsgi import get_wsgi_application

# Produção por padrão; sobrescreva via variável de ambiente quando necessário.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.prod")

application = get_wsgi_application()
