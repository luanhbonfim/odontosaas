"""Testes da trilha de auditoria (LGPD): signals, captura de usuário e API."""

import pytest
from django.db import connection
from django.test import RequestFactory
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.auditoria import middleware
from apps.auditoria.middleware import AuditoriaMiddleware, usuario_atual
from apps.auditoria.models import RegistroAuditoria
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.models import Usuario


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_auditoria_registrada(settings):
    assert "apps.auditoria" in settings.TENANT_APPS
    assert "apps.auditoria.middleware.AuditoriaMiddleware" in settings.MIDDLEWARE


def test_middleware_captura_e_limpa_usuario():
    capturado = {}

    class UsuarioLogado:
        is_authenticated = True
        pk = 1

    class Anonimo:
        is_authenticated = False
        pk = None

    def get_response(request):
        capturado["u"] = usuario_atual()
        return "ok"

    mw = AuditoriaMiddleware(get_response)

    req = RequestFactory().get("/")
    req.user = UsuarioLogado()
    assert mw(req) == "ok"
    assert capturado["u"] is req.user  # disponível durante a requisição
    assert usuario_atual() is None  # limpo ao final

    # Usuário anônimo -> não captura
    req.user = Anonimo()
    mw(req)
    assert capturado["u"] is None


@pytest.mark.django_db(transaction=True)
def test_signals_criacao_alteracao_exclusao():
    clinica = _criar_clinica("aud_tenant", "aud.localhost")
    try:
        with schema_context(clinica.schema_name):
            paciente = Paciente.objects.create(nome_completo="Ana", cpf="11122233344")
            registro = RegistroAuditoria.objects.get(
                modelo="Paciente", acao="CRIACAO", objeto_id=str(paciente.id)
            )
            assert str(registro) == f"Criação Paciente #{paciente.id}"

            paciente.telefone_whatsapp = "5511999998888"
            paciente.save()
            assert RegistroAuditoria.objects.filter(
                modelo="Paciente", acao="ALTERACAO", objeto_id=str(paciente.id)
            ).exists()

            pid = paciente.id
            paciente.delete()
            assert RegistroAuditoria.objects.filter(
                modelo="Paciente", acao="EXCLUSAO", objeto_id=str(pid)
            ).exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_registro_guarda_usuario_responsavel():
    clinica = _criar_clinica("aud_user_tenant", "auduser.localhost")
    try:
        with schema_context(clinica.schema_name):
            user = Usuario.objects.create_user(email="dra@clinica.com", password="x")
            middleware._estado.usuario = user  # simula o que o middleware faria
            try:
                paciente = Paciente.objects.create(nome_completo="Bea", cpf="55566677788")
            finally:
                middleware._estado.usuario = None

            registro = RegistroAuditoria.objects.get(
                modelo="Paciente", acao="CRIACAO", objeto_id=str(paciente.id)
            )
            assert registro.usuario_id == user.id
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_audita_usuario_e_guia():
    """N18: gestão de usuários e movimentações sensíveis também entram na trilha."""
    clinica = _criar_clinica("aud_ext_tenant", "audext.localhost")
    try:
        with schema_context(clinica.schema_name):
            u = Usuario.objects.create_user(email="x@c.com", password="Senha12345")
            assert RegistroAuditoria.objects.filter(
                modelo="Usuario", acao="CRIACAO", objeto_id=str(u.id)
            ).exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_api_auditoria_read_only():
    host = "apiaud.localhost"
    clinica = _criar_clinica("api_aud", host)
    client = APIClient()
    try:
        with schema_context("api_aud"):
            Paciente.objects.create(nome_completo="Ana", cpf="11122233344")

        # listagem com filtro
        resp = client.get("/api/auditoria/?modelo=Paciente&acao=CRIACAO", HTTP_HOST=host)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["modelo"] == "Paciente"

        # somente-leitura: POST não é permitido
        resp = client.post("/api/auditoria/", {"acao": "CRIACAO"}, format="json", HTTP_HOST=host)
        assert resp.status_code == 405
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
