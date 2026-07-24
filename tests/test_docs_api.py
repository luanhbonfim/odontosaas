"""Testes da documentação de API (OpenAPI / Swagger UI / ReDoc via drf-spectacular)."""

import pytest
from django.db import connection
from django.test import Client

from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_schema_openapi_e_docs():
    host = "apidocs.localhost"
    clinica = _criar_clinica("api_docs", host)
    client = Client()
    try:
        # schema OpenAPI
        resp = client.get("/api/schema/", HTTP_HOST=host)
        assert resp.status_code == 200
        corpo = resp.content.decode()
        assert "openapi" in corpo
        assert "OdontoSaaS API" in corpo
        # alguns endpoints do sistema aparecem no schema
        assert "/api/insumos/" in corpo
        assert "/api/lancamentos/" in corpo

        # Swagger UI e ReDoc renderizam (HTML 200)
        assert client.get("/api/docs/", HTTP_HOST=host).status_code == 200
        assert client.get("/api/redoc/", HTTP_HOST=host).status_code == 200
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
