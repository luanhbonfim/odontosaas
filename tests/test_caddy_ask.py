"""
Endpoint de autorização do TLS on-demand do Caddy (/caddy/ask/).

Só autoriza a emissão de certificado (200) para hosts que já são clínicas/plataforma
conhecidas (têm um `Dominio` no banco). Isso viabiliza o multi-tenant por wildcard DNS
sem criar DNS por clínica, impedindo que subdomínios aleatórios façam o Caddy pedir
certificados (abuso / rate-limit do Let's Encrypt).
"""

import pytest
from django.db import connection
from django.test import Client

from apps.tenants.models import Clinica, Dominio


@pytest.mark.django_db(transaction=True)
def test_caddy_ask_autoriza_apenas_dominios_conhecidos():
    connection.set_schema_to_public()
    publico, _ = Clinica.objects.get_or_create(
        schema_name="public",
        defaults={"nome_fantasia": "Público", "razao_social": "Plataforma"},
    )
    Dominio.objects.get_or_create(
        domain="ask-teste.localhost",
        defaults={"tenant": publico, "is_primary": False},
    )

    client = Client()
    try:
        # Host conhecido -> autoriza emissão de cert.
        assert client.get("/caddy/ask/?domain=ask-teste.localhost").status_code == 200
        # Host desconhecido -> nega (não emite cert).
        assert client.get("/caddy/ask/?domain=intruso-aleatorio.localhost").status_code == 404
        # Sem domínio -> 400.
        assert client.get("/caddy/ask/").status_code == 400
    finally:
        Dominio.objects.filter(domain="ask-teste.localhost").delete()
