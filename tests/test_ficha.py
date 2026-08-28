"""Testes do model Ficha + API /api/fichas/."""

from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.agenda.models import Ficha
from apps.core.models import ModeloBase
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_ficha_config():
    assert issubclass(Ficha, ModeloBase)
    assert Ficha._meta.get_field("paciente").many_to_one is True
    assert Ficha._meta.get_field("consulta").one_to_one is True
    assert Ficha._meta.get_field("consulta").null is True
    assert Ficha._meta.get_field("dentes").get_internal_type() == "JSONField"


def test_str():
    from apps.pacientes.models import Paciente

    assert str(Ficha(paciente=Paciente(nome_completo="João"))) == "Ficha de João"


def _criar_paciente_dentista_consulta(client, host, inicio=None):
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
    inicio = inicio or (timezone.now() + timedelta(days=1)).replace(microsecond=0)
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
    return pac, den, consulta


@pytest.mark.django_db(transaction=True)
def test_ficha_avulsa_e_vinculada_a_consulta():
    host = "ficha.localhost"
    clinica = _criar_clinica("ficha_tenant", host)
    client = APIClient()
    try:
        pac, _den, consulta = _criar_paciente_dentista_consulta(client, host)

        # Ficha avulsa (sem consulta) é válida.
        resp = client.post(
            "/api/fichas/",
            {"paciente": pac["id"], "anotacoes": "Avaliação inicial"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        assert resp.json()["consulta"] is None

        # Ficha vinculada a uma consulta do mesmo paciente.
        dentes = [{"dente": 44, "procedimento": "Restauração"}]
        resp = client.post(
            "/api/fichas/",
            {
                "paciente": pac["id"],
                "consulta": consulta["id"],
                "dentes": dentes,
                "anotacoes": "Restauração no 44.",
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        data = resp.json()
        assert data["dentes"] == dentes
        assert data["consulta"] == consulta["id"]
        assert data["consulta_dentista_nome"]

        assert len(client.get("/api/fichas/", HTTP_HOST=host).json()) == 2
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_ficha_nao_permite_duas_para_mesma_consulta():
    host = "ficha-dup.localhost"
    clinica = _criar_clinica("ficha_dup_tenant", host)
    client = APIClient()
    try:
        pac, _den, consulta = _criar_paciente_dentista_consulta(client, host)

        assert (
            client.post(
                "/api/fichas/",
                {"paciente": pac["id"], "consulta": consulta["id"]},
                format="json",
                HTTP_HOST=host,
            ).status_code
            == 201
        )
        # Segunda ficha para a mesma consulta -> 400 (unicidade do OneToOneField).
        resp = client.post(
            "/api/fichas/",
            {"paciente": pac["id"], "consulta": consulta["id"]},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_ficha_consulta_deve_ser_do_mesmo_paciente():
    host = "ficha-outropac.localhost"
    clinica = _criar_clinica("ficha_outropac_tenant", host)
    client = APIClient()
    try:
        pac1, _den1, consulta1 = _criar_paciente_dentista_consulta(client, host)
        pac2 = client.post(
            "/api/pacientes/",
            {"nome_completo": "Outro Paciente", "cpf": "55566677788"},
            format="json",
            HTTP_HOST=host,
        ).json()

        resp = client.post(
            "/api/fichas/",
            {"paciente": pac2["id"], "consulta": consulta1["id"]},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "consulta" in resp.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
