"""Templates de mensagem: unicidade (confirmação/cancelamento/agradecimento) e
validação dos campos de Lembrete (recall x aviso antes da consulta)."""

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
def test_template_unico_e_lembrete_validacoes():
    host = "tmpl.localhost"
    clinica = _criar_clinica("tmpl_tenant", host)
    client = APIClient()  # superuser (conftest)
    try:

        def criar(dados):
            return client.post("/api/templates-mensagem/", dados, format="json", HTTP_HOST=host)

        # Confirmação: 1º ok, 2º barrado (singleton).
        assert criar({"tipo": "CONFIRMACAO", "corpo": "Oi {{paciente}}"}).status_code == 201
        assert criar({"tipo": "CONFIRMACAO", "corpo": "Outro"}).status_code == 400

        # Procedimento para o recall.
        proc = client.post(
            "/api/procedimentos/", {"nome": "Limpeza"}, format="json", HTTP_HOST=host
        ).json()["id"]

        # Lembrete RECALL: sem procedimento/intervalo -> 400; completo -> 201.
        assert (
            criar({"tipo": "LEMBRETE", "corpo": "Volte!", "lembrete_tipo": "RECALL"}).status_code
            == 400
        )
        ok = criar(
            {
                "tipo": "LEMBRETE",
                "corpo": "Volte, {{paciente}}!",
                "lembrete_tipo": "RECALL",
                "procedimento": proc,
                "intervalo_meses": 6,
            }
        )
        assert ok.status_code == 201, ok.content

        # Lembrete PRE_CONSULTA: sem horas -> 400; com horas -> 201 (vários lembretes ok).
        assert (
            criar(
                {"tipo": "LEMBRETE", "corpo": "Amanhã!", "lembrete_tipo": "PRE_CONSULTA"}
            ).status_code
            == 400
        )
        aviso = criar(
            {
                "tipo": "LEMBRETE",
                "corpo": "Sua consulta é às {{hora}}",
                "lembrete_tipo": "PRE_CONSULTA",
                "horas_antes": 2,
            }
        )
        assert aviso.status_code == 201, aviso.content
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
