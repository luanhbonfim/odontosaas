"""Testes do model Anamnese + API /api/anamneses/."""

from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agenda.models import Anamnese
from apps.core.models import ModeloBase
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_anamnese_config():
    assert issubclass(Anamnese, ModeloBase)
    assert Anamnese._meta.get_field("paciente").many_to_one is True
    assert Anamnese._meta.get_field("consulta").null is True
    assert Anamnese._meta.get_field("historico_medico").get_internal_type() == "JSONField"


def test_str():
    from apps.pacientes.models import Paciente

    assert str(Anamnese(paciente=Paciente(nome_completo="João"))) == "Anamnese de João"


# --- Registro real via API ---
@pytest.mark.django_db(transaction=True)
def test_registrar_anamnese():
    host = "anamnese.localhost"
    clinica = _criar_clinica("anamnese_tenant", host)
    client = APIClient()
    try:
        pac = client.post(
            "/api/pacientes/",
            {"nome_completo": "Paciente", "cpf": "22233344455"},
            format="json",
            HTTP_HOST=host,
        ).json()
        den = client.post(
            "/api/dentistas/",
            {"nome_completo": "Dentista", "cro": "CRO-A"},
            format="json",
            HTTP_HOST=host,
        ).json()
        inicio = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        consulta = client.post(
            "/api/consultas/",
            {
                "paciente": pac["id"],
                "dentista": den["id"],
                "inicio": inicio.isoformat(),
                "fim": (inicio + timedelta(minutes=30)).isoformat(),
            },
            format="json",
            HTTP_HOST=host,
        ).json()

        # Anamnese vinculada a paciente + consulta, com histórico em JSON
        resp = client.post(
            "/api/anamneses/",
            {
                "paciente": pac["id"],
                "consulta": consulta["id"],
                "queixa_principal": "Dor de dente",
                "historico_medico": {"alergias": ["dipirona"], "doencas": ["hipertensao"]},
                "diabetico": True,
                "registrado_por": den["id"],
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        data = resp.json()
        assert data["historico_medico"]["alergias"] == ["dipirona"]
        assert data["diabetico"] is True

        # Anamnese inicial (sem consulta) também é válida
        resp = client.post(
            "/api/anamneses/",
            {"paciente": pac["id"], "queixa_principal": "Avaliação inicial"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201
        assert resp.json()["consulta"] is None

        assert len(client.get("/api/anamneses/", HTTP_HOST=host).json()) == 2
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
