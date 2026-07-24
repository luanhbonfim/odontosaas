"""Testes do agendamento de consulta (API + verificação de conflito de horário)."""

from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _base(client, host, cro="CRO-1", cpf="11122233344"):
    paciente = client.post(
        "/api/pacientes/",
        {"nome_completo": "Paciente", "cpf": cpf},
        format="json",
        HTTP_HOST=host,
    ).json()
    dentista = client.post(
        "/api/dentistas/",
        {"nome_completo": "Dentista", "cro": cro},
        format="json",
        HTTP_HOST=host,
    ).json()
    return paciente["id"], dentista["id"]


@pytest.mark.django_db(transaction=True)
def test_agendamento_e_conflito_de_horario():
    host = "agendamento.localhost"
    clinica = _criar_clinica("agendamento_tenant", host)
    client = APIClient()
    try:
        pac, den = _base(client, host)
        pac2, den2 = _base(client, host, cro="CRO-2", cpf="55566677788")

        inicio = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        fim = inicio + timedelta(minutes=30)

        def agendar(dentista, ini, f, paciente=pac):
            return client.post(
                "/api/consultas/",
                {
                    "paciente": paciente,
                    "dentista": dentista,
                    "inicio": ini.isoformat(),
                    "fim": f.isoformat(),
                },
                format="json",
                HTTP_HOST=host,
            )

        # 1) Agenda ok
        assert agendar(den, inicio, fim).status_code == 201

        # 2) Sobreposição no mesmo dentista -> 400
        resp = agendar(den, inicio + timedelta(minutes=15), fim + timedelta(minutes=15))
        assert resp.status_code == 400

        # 3) Mesmo horário, dentista diferente -> 201 (sem conflito)
        assert agendar(den2, inicio, fim, paciente=pac2).status_code == 201

        # 4) Horário adjacente (sem sobreposição) no mesmo dentista -> 201
        assert agendar(den, fim, fim + timedelta(minutes=30)).status_code == 201

        # 5) fim <= inicio -> 400
        resp = agendar(den, inicio, inicio)
        assert resp.status_code == 400
        assert "fim" in resp.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_consulta_cancelada_nao_bloqueia_horario():
    host = "cancelada.localhost"
    clinica = _criar_clinica("cancelada_tenant", host)
    client = APIClient()
    try:
        pac, den = _base(client, host)
        inicio = (timezone.now() + timedelta(days=2)).replace(microsecond=0)
        fim = inicio + timedelta(minutes=30)

        c1 = client.post(
            "/api/consultas/",
            {
                "paciente": pac,
                "dentista": den,
                "inicio": inicio.isoformat(),
                "fim": fim.isoformat(),
            },
            format="json",
            HTTP_HOST=host,
        ).json()
        # Cancela a primeira
        client.patch(
            f"/api/consultas/{c1['id']}/",
            {"status": "CANCELADA"},
            format="json",
            HTTP_HOST=host,
        )
        # Agora o mesmo horário fica livre -> 201
        resp = client.post(
            "/api/consultas/",
            {
                "paciente": pac,
                "dentista": den,
                "inicio": inicio.isoformat(),
                "fim": fim.isoformat(),
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
