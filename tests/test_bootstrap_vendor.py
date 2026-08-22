"""
Teste do fluxo de bootstrap do Vendor Admin em ambiente novo:
- `bootstrap_vendor` mapeia o host do painel -> public, cria plano padrão e
  provisiona a primeira clínica (que semeia o operador Master).
- Com o Master semeado, o login no painel (VendorLoginView) funciona.
"""

import pytest
from django.core.management import call_command
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework import status
from rest_framework.test import APIClient

from apps.plataforma.models import PlanoAssinatura
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.models import Usuario


@pytest.mark.django_db(transaction=True)
def test_bootstrap_vendor_habilita_login_no_painel():
    connection.set_schema_to_public()
    # Garante o tenant public (normalmente criado pela migração 0003).
    Clinica.objects.get_or_create(
        schema_name="public",
        defaults={"nome_fantasia": "Público", "razao_social": "Plataforma"},
    )

    schema = "bootstrap_test"
    host_painel = "ops-teste-bootstrap.localhost"
    dominio_clinica = "bootstraptest.localhost"

    try:
        call_command(
            "bootstrap_vendor",
            host=host_painel,
            clinica_schema=schema,
            clinica_nome="Clínica Bootstrap",
            clinica_dominio=dominio_clinica,
        )

        # 1. Host do painel -> public
        dom = Dominio.objects.get(domain=host_painel)
        assert dom.tenant.schema_name == "public"

        # 2. Plano padrão criado
        assert PlanoAssinatura.objects.exists()

        # 3. Clínica provisionada + Master (is_superuser) semeado no schema dela
        assert Clinica.objects.filter(schema_name=schema).exists()
        with schema_context(schema):
            master = Usuario.objects.get(email="admin@proclinica.com.br")
            assert master.is_superuser is True
            assert master.is_active is True

        # 4. Login no painel funciona com o Master (senha default de dev/testes)
        from django.core.cache import cache

        cache.clear()
        client = APIClient()
        # Loga pelo HOST DO PAINEL (mapeado para public pelo bootstrap) — robusto a
        # outros testes que mexam no domínio "localhost".
        client.defaults["HTTP_HOST"] = host_painel
        resp = client.post(
            "/api/plataforma-admin/auth/login/",
            {"email": "admin@proclinica.com.br", "password": "ProClinica@2026"},
            format="json",
            HTTP_HOST=host_painel,
        )
        assert resp.status_code == status.HTTP_200_OK, resp.content
        assert "access" in resp.json()
    finally:
        connection.set_schema_to_public()
        Dominio.objects.filter(domain=host_painel).delete()
        clinica = Clinica.objects.filter(schema_name=schema).first()
        if clinica:
            clinica.delete(force_drop=True)
