"""Testes do catálogo de Procedimentos: model, CRUD, permissão por papel."""

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.procedimentos.models import Procedimento
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.perfis import sincronizar_grupos

Usuario = get_user_model()


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def test_procedimento_str():
    assert str(Procedimento(nome="Limpeza")) == "Limpeza"


@pytest.mark.django_db(transaction=True)
def test_crud_procedimento():
    host = "proc.localhost"
    clinica = _criar_clinica("proc_tenant", host)
    client = APIClient()  # auto-autenticado (conftest, superuser)
    try:
        criar = client.post(
            "/api/procedimentos/", {"nome": "Limpeza"}, format="json", HTTP_HOST=host
        )
        assert criar.status_code == 201, criar.content
        pid = criar.json()["id"]

        assert client.get("/api/procedimentos/", HTTP_HOST=host).status_code == 200

        # Nome duplicado -> 400
        dup = client.post(
            "/api/procedimentos/", {"nome": "Limpeza"}, format="json", HTTP_HOST=host
        )
        assert dup.status_code == 400

        # Editar (renomear)
        edit = client.patch(
            f"/api/procedimentos/{pid}/", {"nome": "Limpeza dental"}, format="json", HTTP_HOST=host
        )
        assert edit.status_code == 200 and edit.json()["nome"] == "Limpeza dental"

        # Excluir (sem vínculos) -> 204
        assert client.delete(f"/api/procedimentos/{pid}/", HTTP_HOST=host).status_code == 204
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_consulta_vincula_procedimento_e_exclusao_protegida():
    from datetime import timedelta

    from django.utils import timezone

    host = "proccons.localhost"
    clinica = _criar_clinica("proccons_tenant", host)
    client = APIClient()
    try:
        proc = client.post(
            "/api/procedimentos/", {"nome": "Limpeza"}, format="json", HTTP_HOST=host
        ).json()["id"]
        pac = client.post(
            "/api/pacientes/",
            {"nome_completo": "Zé", "cpf": "11122233344"},
            format="json",
            HTTP_HOST=host,
        ).json()["id"]
        den = client.post(
            "/api/dentistas/",
            {"nome_completo": "Dra", "cro": "CRO-9"},
            format="json",
            HTTP_HOST=host,
        ).json()["id"]
        inicio = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        consulta = client.post(
            "/api/consultas/",
            {
                "paciente": pac,
                "dentista": den,
                "inicio": inicio.isoformat(),
                "fim": (inicio + timedelta(minutes=30)).isoformat(),
                "procedimento_catalogo": proc,
                "observacoes": "cuidado com sensibilidade",
            },
            format="json",
            HTTP_HOST=host,
        )
        assert consulta.status_code == 201, consulta.content
        assert consulta.json()["procedimento_catalogo"] == proc
        assert consulta.json()["procedimento_catalogo_nome"] == "Limpeza"

        # Procedimento em uso -> exclusão protegida (400, PROTECT tratado).
        assert client.delete(f"/api/procedimentos/{proc}/", HTTP_HOST=host).status_code == 400
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_procedimentos_permissao_por_papel():
    host = "procperm.localhost"
    clinica = _criar_clinica("procperm_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(email="recep@c.com", password="Senha12345", papel="RECEPCAO")
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
                "/api/procedimentos/", {"nome": "Limpeza"}, format="json", HTTP_HOST=host
            ).status_code
            == 201
        )
        # Dentista: só lê (para selecionar), não cria (403)
        assert dent.get("/api/procedimentos/", HTTP_HOST=host).status_code == 200
        assert (
            dent.post(
                "/api/procedimentos/", {"nome": "Canal"}, format="json", HTTP_HOST=host
            ).status_code
            == 403
        )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()
