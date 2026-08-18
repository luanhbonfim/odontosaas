"""Testes do app dentistas (Dentista, Especialidade)."""

import pytest
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.core.models import ModeloBase
from apps.dentistas.models import Dentista, Especialidade
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_dentistas_no_tenant_apps(settings):
    assert "apps.dentistas" in settings.TENANT_APPS


def test_modelos_herdam_modelo_base():
    assert issubclass(Dentista, ModeloBase)
    assert issubclass(Especialidade, ModeloBase)


def test_dentista_campos():
    assert Dentista._meta.get_field("cro").unique is True
    assert Dentista._meta.get_field("especialidades").many_to_many is True
    assert Dentista._meta.get_field("usuario").one_to_one is True


def test_str():
    assert str(Especialidade(nome="Ortodontia")) == "Ortodontia"
    assert str(Dentista(nome_completo="Dra. Ana", cro="12345")) == "Dra. Ana (CRO 12345)"


# --- Criação real dentro do schema de um tenant ---
@pytest.mark.django_db(transaction=True)
def test_criar_dentista_com_especialidades():
    clinica = _criar_clinica("dentistas_tenant", "dentistas.localhost")
    try:
        with schema_context(clinica.schema_name):
            orto = Especialidade.objects.create(nome="Ortodontia")
            endo = Especialidade.objects.create(nome="Endodontia")
            dentista = Dentista.objects.create(nome_completo="Dra. Ana Souza", cro="CRO-SP-12345")
            dentista.especialidades.add(orto, endo)

            assert Dentista.objects.count() == 1
            assert dentista.especialidades.count() == 2
            assert orto.dentistas.first() == dentista
    finally:
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_api_especialidades_e_nomes_no_dentista():
    host = "esp.localhost"
    clinica = _criar_clinica("esp_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            orto = Especialidade.objects.create(nome="Ortodontia")
            dentista = Dentista.objects.create(nome_completo="Dra. Ana", cro="CRO-9")
            dentista.especialidades.add(orto)

        client = APIClient()  # auto-autenticado (conftest)

        # Endpoint de especialidades lista os registros
        resp = client.get("/api/especialidades/", HTTP_HOST=host)
        assert resp.status_code == 200
        assert [e["nome"] for e in resp.json()] == ["Ortodontia"]

        # O dentista expõe os nomes das especialidades (leitura)
        dados = client.get("/api/dentistas/", HTTP_HOST=host).json()
        assert dados[0]["especialidades_nomes"] == ["Ortodontia"]
        assert dados[0]["especialidades"] == [orto.id]
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_gerente_nao_aponta_dentista_para_admin():
    """Regressão de segurança: o campo `usuario` do dentista é somente-leitura,
    então não dá para apontar um dentista para o Usuario de um Admin pela API de
    dentistas. A gestão do login (senha/bloqueio) vive só em Equipe, protegida
    pela hierarquia do UsuarioViewSet."""
    from django.contrib.auth import get_user_model
    from django.core.cache import cache

    from apps.usuarios.perfis import sincronizar_grupos

    host = "hijack.localhost"
    clinica = _criar_clinica("hijack_tenant", host)
    Usuario = get_user_model()
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            admin = Usuario.objects.create_user(
                email="admin@c.com", password="AdminSenha123", papel="ADMIN"
            )
            Usuario.objects.create_user(
                email="gerente@c.com", password="Senha12345", papel="DENTISTA_GERENTE"
            )

        cache.clear()
        client = APIClient()
        tok = client.post(
            "/api/auth/token/",
            {"email": "gerente@c.com", "password": "Senha12345"},
            format="json",
            HTTP_HOST=host,
        ).json()["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")

        # `usuario` é somente-leitura: tentar apontar o dentista para o Admin é ignorado.
        criar = client.post(
            "/api/dentistas/",
            {"nome_completo": "Fake", "cro": "CRO-HJ1", "usuario": admin.id},
            format="json",
            HTTP_HOST=host,
        )
        assert criar.status_code == 201, criar.content
        with schema_context(clinica.schema_name):
            d = Dentista.objects.get(id=criar.json()["id"])
            assert d.usuario_id is None  # NÃO vinculou ao Admin
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()


@pytest.mark.django_db(transaction=True)
def test_excluir_dentista_com_consulta_e_sem_consulta():
    from datetime import timedelta

    from django.utils import timezone

    from apps.agenda.models import Consulta
    from apps.pacientes.models import Paciente

    host = "delprot.localhost"
    clinica = _criar_clinica("delprot_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            paciente = Paciente.objects.create(nome_completo="João", cpf="11122233344")
            com_consulta = Dentista.objects.create(nome_completo="Com Consulta", cro="CRO-D1")
            inicio = timezone.now() + timedelta(days=1)
            Consulta.objects.create(
                paciente=paciente,
                dentista=com_consulta,
                inicio=inicio,
                fim=inicio + timedelta(hours=1),
            )
            sem_consulta = Dentista.objects.create(nome_completo="Sem Consulta", cro="CRO-D2")

        client = APIClient()
        # Com consulta vinculada (PROTECT) -> 400 tratado (não 500)
        assert (
            client.delete(f"/api/dentistas/{com_consulta.id}/", HTTP_HOST=host).status_code == 400
        )
        # Sem vínculos -> 204
        assert (
            client.delete(f"/api/dentistas/{sem_consulta.id}/", HTTP_HOST=host).status_code == 204
        )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


