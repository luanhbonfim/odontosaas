"""Filtro `?paciente=` nos endpoints da Ficha do Paciente.

Planos, guias, consultas e anamneses passam a poder ser listados por paciente
(`FiltraPorPacienteMixin`), base da tela de detalhe do paciente.
"""

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


@pytest.mark.django_db(transaction=True)
def test_ficha_filtra_relacoes_por_paciente():
    host = "ficha.localhost"
    clinica = _criar_clinica("ficha_tenant", host)
    client = APIClient()  # auto-autenticado (conftest, superuser)
    try:

        def criar_paciente(nome, cpf):
            return client.post(
                "/api/pacientes/",
                {"nome_completo": nome, "cpf": cpf},
                format="json",
                HTTP_HOST=host,
            ).json()["id"]

        a = criar_paciente("Paciente A", "11111111111")
        b = criar_paciente("Paciente B", "22222222222")
        den = client.post(
            "/api/dentistas/",
            {"nome_completo": "Dentista", "cro": "CRO-F1"},
            format="json",
            HTTP_HOST=host,
        ).json()["id"]

        def criar_plano(pac, operadora):
            return client.post(
                "/api/planos/",
                {"paciente": pac, "operadora": operadora},
                format="json",
                HTTP_HOST=host,
            ).json()["id"]

        plano_a = criar_plano(a, "Amil")
        plano_b = criar_plano(b, "Bradesco")

        def criar_guia(plano, numero):
            return client.post(
                "/api/guias/",
                {
                    "plano": plano,
                    "numero_guia": numero,
                    "procedimento": "Limpeza",
                    "valor": "100.00",
                },
                format="json",
                HTTP_HOST=host,
            )

        assert criar_guia(plano_a, "G-A").status_code == 201
        assert criar_guia(plano_b, "G-B").status_code == 201

        inicio = (timezone.now() + timedelta(days=1)).replace(microsecond=0)

        def criar_consulta(pac, ini):
            return client.post(
                "/api/consultas/",
                {
                    "paciente": pac,
                    "dentista": den,
                    "inicio": ini.isoformat(),
                    "fim": (ini + timedelta(minutes=30)).isoformat(),
                },
                format="json",
                HTTP_HOST=host,
            )

        assert criar_consulta(a, inicio).status_code == 201
        assert criar_consulta(b, inicio + timedelta(hours=1)).status_code == 201

        def criar_anamnese(pac):
            return client.post(
                "/api/anamneses/",
                {"paciente": pac, "queixa_principal": "dor"},
                format="json",
                HTTP_HOST=host,
            )

        assert criar_anamnese(a).status_code == 201
        assert criar_anamnese(b).status_code == 201

        def lista(endpoint, params=""):
            return client.get(f"/api/{endpoint}/{params}", HTTP_HOST=host).json()

        # Sem filtro: todos os registros (2 de cada)
        assert len(lista("planos")) == 2
        assert len(lista("guias")) == 2
        assert len(lista("consultas")) == 2
        assert len(lista("anamneses")) == 2

        # Com ?paciente=A: só os do paciente A (1 de cada)
        assert len(lista("planos", f"?paciente={a}")) == 1
        assert len(lista("guias", f"?paciente={a}")) == 1
        assert len(lista("consultas", f"?paciente={a}")) == 1
        assert len(lista("anamneses", f"?paciente={a}")) == 1

        # Confere que veio o registro do paciente certo
        assert lista("planos", f"?paciente={a}")[0]["operadora"] == "Amil"
        assert lista("guias", f"?paciente={b}")[0]["numero_guia"] == "G-B"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
