"""Testes do catálogo de Convênios: model, CRUD, permissão por papel, exclusão protegida."""

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.convenios.models import Convenio
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.perfis import sincronizar_grupos

Usuario = get_user_model()


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def test_convenio_str():
    assert str(Convenio(nome="Amil Dental")) == "Amil Dental"


@pytest.mark.django_db(transaction=True)
def test_crud_convenio_e_plano_preenche_operadora():
    host = "conv.localhost"
    clinica = _criar_clinica("conv_tenant", host)
    client = APIClient()  # auto-autenticado (conftest, superuser)
    try:
        # CREATE
        criar = client.post(
            "/api/convenios/", {"nome": "Amil Dental"}, format="json", HTTP_HOST=host
        )
        assert criar.status_code == 201, criar.content
        cid = criar.json()["id"]

        # LIST
        assert client.get("/api/convenios/", HTTP_HOST=host).status_code == 200

        # Nome duplicado -> 400
        dup = client.post("/api/convenios/", {"nome": "Amil Dental"}, format="json", HTTP_HOST=host)
        assert dup.status_code == 400

        # Plano vinculado ao convênio -> `operadora` é preenchida a partir do convênio
        pac = client.post(
            "/api/pacientes/",
            {"nome_completo": "Zé", "cpf": "11122233344"},
            format="json",
            HTTP_HOST=host,
        ).json()["id"]
        plano = client.post(
            "/api/planos/", {"paciente": pac, "convenio": cid}, format="json", HTTP_HOST=host
        )
        assert plano.status_code == 201, plano.content
        assert plano.json()["operadora"] == "Amil Dental"
        assert plano.json()["convenio_nome"] == "Amil Dental"

        # A listagem conta os pacientes distintos vinculados ao convênio.
        conv = next(c for c in client.get("/api/convenios/", HTTP_HOST=host).json() if c["id"] == cid)
        assert conv["pacientes"] == 1
        # Um 2º plano do MESMO paciente não duplica a contagem (pacientes distintos).
        client.post("/api/planos/", {"paciente": pac, "convenio": cid}, format="json", HTTP_HOST=host)
        conv = next(c for c in client.get("/api/convenios/", HTTP_HOST=host).json() if c["id"] == cid)
        assert conv["pacientes"] == 1

        # Excluir convênio com plano vinculado -> 400 (PROTECT tratado)
        assert client.delete(f"/api/convenios/{cid}/", HTTP_HOST=host).status_code == 400

        # Convênio sem planos -> 204
        livre = client.post(
            "/api/convenios/", {"nome": "Uniodonto"}, format="json", HTTP_HOST=host
        ).json()["id"]
        assert client.delete(f"/api/convenios/{livre}/", HTTP_HOST=host).status_code == 204

        # Sem convênio e sem operadora -> 400
        sem = client.post("/api/planos/", {"paciente": pac}, format="json", HTTP_HOST=host)
        assert sem.status_code == 400
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_convenios_permissao_por_papel():
    host = "convperm.localhost"
    clinica = _criar_clinica("convperm_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(
                email="recep@c.com", password="Senha12345", papel="RECEPCAO"
            )
            Usuario.objects.create_user(email="dent@c.com", password="Senha12345", papel="DENTISTA")

        def cliente(email):
            cache.clear()
            c = APIClient()
            tok = c.post(
                "/api/auth/token/",
                {"email": email, "password": "Senha12345"},
                format="json",
                HTTP_HOST=host,
            ).json()["access"]
            c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
            return c

        recep = cliente("recep@c.com")
        dent = cliente("dent@c.com")

        # Recepção: gerencia o catálogo (full)
        assert (
            recep.post(
                "/api/convenios/", {"nome": "Amil"}, format="json", HTTP_HOST=host
            ).status_code
            == 201
        )
        # Dentista: só lê (para selecionar), não cria (403)
        assert dent.get("/api/convenios/", HTTP_HOST=host).status_code == 200
        assert (
            dent.post(
                "/api/convenios/", {"nome": "Bradesco"}, format="json", HTTP_HOST=host
            ).status_code
            == 403
        )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()
