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
        assert resp.json()["count"] == 1
        assert resp.json()["results"][0]["modelo"] == "Paciente"

        # somente-leitura: POST não é permitido
        resp = client.post("/api/auditoria/", {"acao": "CRIACAO"}, format="json", HTTP_HOST=host)
        assert resp.status_code == 405
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


def _cliente_jwt(host, email):
    from django.core.cache import cache

    cache.clear()
    c = APIClient()
    tok = c.post(
        "/api/auth/token/", {"email": email, "password": "Senha12345"}, format="json", HTTP_HOST=host
    ).json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
    return c


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_api_auditoria_permissao_filtros_e_paginacao():
    from datetime import timedelta

    from django.utils import timezone

    from apps.usuarios.perfis import sincronizar_grupos

    host = "apiaud2.localhost"
    clinica = _criar_clinica("api_aud2", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            adm = Usuario.objects.create_user(
                email="adm@c.com", password="Senha12345", papel="ADMIN", nome_completo="Admin Silva"
            )
            Usuario.objects.create_user(email="ger@c.com", password="Senha12345", papel="DENTISTA_GERENTE")
            Usuario.objects.create_user(email="rec@c.com", password="Senha12345", papel="RECEPCAO")
            Usuario.objects.create_user(email="den@c.com", password="Senha12345", papel="DENTISTA")
            RegistroAuditoria.objects.all().delete()
            for i in range(25):
                RegistroAuditoria.objects.create(
                    acao="CRIACAO", modelo="Paciente", objeto_id=str(i), objeto_repr=f"Paciente {i}", usuario=adm
                )
            antigo = RegistroAuditoria.objects.create(
                acao="EXCLUSAO", modelo="Guia", objeto_id="9", objeto_repr="Guia G-9", usuario=None
            )
            RegistroAuditoria.objects.filter(pk=antigo.pk).update(
                criado_em=timezone.now() - timedelta(days=10)
            )

        admin = _cliente_jwt(host, "adm@c.com")
        # Paginada (20 por página) e ordenada do mais recente
        r = admin.get("/api/auditoria/", HTTP_HOST=host).json()
        assert r["count"] == 26 and len(r["results"]) == 20 and r["next"]
        assert r["results"][0]["usuario_nome"] == "Admin Silva"
        assert r["results"][0]["acao_rotulo"] == "Criação"

        # Filtros: modelo, ação, usuário, busca, período (dias inclusivos, fuso local)
        assert admin.get("/api/auditoria/?modelo=Guia", HTTP_HOST=host).json()["count"] == 1
        sistema = admin.get("/api/auditoria/?acao=EXCLUSAO", HTTP_HOST=host).json()["results"][0]
        assert sistema["usuario_nome"] == ""  # ação sem usuário (sistema)
        assert admin.get("/api/auditoria/?usuario=abc", HTTP_HOST=host).json()["count"] == 0
        assert admin.get(f"/api/auditoria/?usuario={adm.id}", HTTP_HOST=host).json()["count"] >= 25
        assert admin.get("/api/auditoria/?search=guia g-9", HTTP_HOST=host).json()["count"] == 1
        assert admin.get("/api/auditoria/?search=admin silva", HTTP_HOST=host).json()["count"] >= 25
        hoje = timezone.localdate().isoformat()
        assert admin.get(f"/api/auditoria/?de={hoje}&ate={hoje}&modelo=Paciente", HTTP_HOST=host).json()["count"] == 25
        assert admin.get(f"/api/auditoria/?de={hoje}&modelo=Guia", HTTP_HOST=host).json()["count"] == 0
        assert admin.get(f"/api/auditoria/?ate={hoje}&modelo=Guia", HTTP_HOST=host).json()["count"] == 1
        # data inválida é ignorada (não 500)
        assert admin.get("/api/auditoria/?de=ontem", HTTP_HOST=host).status_code == 200

        # Gerente lê; Recepção e Dentista não têm o módulo
        assert _cliente_jwt(host, "ger@c.com").get("/api/auditoria/", HTTP_HOST=host).status_code == 200
        assert _cliente_jwt(host, "rec@c.com").get("/api/auditoria/", HTTP_HOST=host).status_code == 403
        assert _cliente_jwt(host, "den@c.com").get("/api/auditoria/", HTTP_HOST=host).status_code == 403
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_auditoria_registra_usuario_no_fluxo_jwt():
    """Regressão: o middleware roda antes do DRF autenticar o JWT, então a trilha
    ficava sem usuário ("Sistema") em toda ação feita pela API."""
    from apps.usuarios.perfis import sincronizar_grupos

    host = "audjwt.localhost"
    clinica = _criar_clinica("aud_jwt", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            adm = Usuario.objects.create_user(email="adm@c.com", password="Senha12345", papel="ADMIN")
        cliente = _cliente_jwt(host, "adm@c.com")
        resp = cliente.post(
            "/api/pacientes/",
            {"nome_completo": "Via API", "cpf": "11122233344"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        with schema_context(clinica.schema_name):
            registro = RegistroAuditoria.objects.get(modelo="Paciente", acao="CRIACAO")
            assert registro.usuario_id == adm.id
        # Sem vazamento entre requisições: fora de um request volta a não ter usuário.
        assert usuario_atual() is None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
