"""Testes dos endpoints de personalização (configuração + templates)."""

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_personalizar_configuracao_e_template():
    host = "config.localhost"
    clinica = _criar_clinica("config_notif_tenant", host)
    client = APIClient()
    try:
        # Cria a configuração da clínica
        resp = client.post(
            "/api/config-notificacao/",
            {"dias_antecedencia": 2, "horario_envio": "08:30:00", "waha_session": "clinica-x"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        cfg_id = resp.json()["id"]

        # Ajusta a antecedência (personalização)
        resp = client.patch(
            f"/api/config-notificacao/{cfg_id}/",
            {"dias_antecedencia": 3},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 200
        assert resp.json()["dias_antecedencia"] == 3

        # Cria um template de confirmação
        resp = client.post(
            "/api/templates-mensagem/",
            {"tipo": "CONFIRMACAO", "corpo": "Olá {{paciente}}, confirma {{data}} {{hora}}?"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201
        assert "{{paciente}}" in resp.json()["corpo"]

        # tipo inválido -> 400
        resp = client.post(
            "/api/templates-mensagem/",
            {"tipo": "INVALIDO", "corpo": "x"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "tipo" in resp.json()

        assert len(client.get("/api/templates-mensagem/", HTTP_HOST=host).json()) == 1
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
