"""Testes da API REST de Usuário (equipe da clínica): CRUD, papel→grupo, permissão."""

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio
from apps.usuarios.perfis import sincronizar_grupos

Usuario = get_user_model()


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_crud_usuario_e_papel_vira_grupo():
    host = "equipe.localhost"
    clinica = _criar_clinica("equipe_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()

        client = APIClient()  # auto-autenticado (conftest, superuser)

        # CREATE (Recepção) — senha não volta na resposta
        resp = client.post(
            "/api/usuarios/",
            {
                "email": "recep@c.com",
                "nome_completo": "Rita Recep",
                "papel": "RECEPCAO",
                "senha": "Senha12345",
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        assert "senha" not in resp.json()
        uid = resp.json()["id"]

        with schema_context(clinica.schema_name):
            u = Usuario.objects.get(id=uid)
            assert u.check_password("Senha12345")
            assert list(u.groups.values_list("name", flat=True)) == ["RECEPCAO"]

        # LIST
        assert client.get("/api/usuarios/", HTTP_HOST=host).status_code == 200

        # UPDATE papel -> ADMIN (grupo acompanha) + troca de senha
        r = client.patch(
            f"/api/usuarios/{uid}/",
            {"papel": "ADMIN", "senha": "OutraSenha99"},
            format="json",
            HTTP_HOST=host,
        )
        assert r.status_code == 200
        with schema_context(clinica.schema_name):
            u = Usuario.objects.get(id=uid)
            assert list(u.groups.values_list("name", flat=True)) == ["ADMIN"]
            assert u.check_password("OutraSenha99")

        # Bloquear acesso (ativo=false)
        r = client.patch(f"/api/usuarios/{uid}/", {"ativo": False}, format="json", HTTP_HOST=host)
        assert r.status_code == 200 and r.json()["ativo"] is False

        # E-mail duplicado -> 400
        dup = client.post(
            "/api/usuarios/",
            {"email": "recep@c.com", "nome_completo": "X", "papel": "RECEPCAO", "senha": "x12345"},
            format="json",
            HTTP_HOST=host,
        )
        assert dup.status_code == 400

        # Sem senha na criação -> 400
        sem = client.post(
            "/api/usuarios/",
            {"email": "novo@c.com", "nome_completo": "Novo", "papel": "RECEPCAO"},
            format="json",
            HTTP_HOST=host,
        )
        assert sem.status_code == 400

        # Senha fraca -> 400 (AUTH_PASSWORD_VALIDATORS)
        fraca = client.post(
            "/api/usuarios/",
            {"email": "novo@c.com", "nome_completo": "Novo", "papel": "RECEPCAO", "senha": "1"},
            format="json",
            HTTP_HOST=host,
        )
        assert fraca.status_code == 400
        assert "senha" in fraca.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_usuarios_apenas_gerente_admin():
    host = "equipe2.localhost"
    clinica = _criar_clinica("equipe2_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(
                email="recep@c.com", password="Senha12345", papel="RECEPCAO"
            )
            Usuario.objects.create_user(
                email="gerente@c.com", password="Senha12345", papel="DENTISTA_GERENTE"
            )

        def acessa(email):
            cache.clear()
            client = APIClient()
            token = client.post(
                "/api/auth/token/",
                {"email": email, "password": "Senha12345"},
                format="json",
                HTTP_HOST=host,
            ).json()["access"]
            client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
            return client.get("/api/usuarios/", HTTP_HOST=host).status_code

        assert acessa("recep@c.com") == 403  # Recepção não gerencia usuários
        assert acessa("gerente@c.com") == 200  # Gerente sim
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_hierarquia_gerente_so_gerencia_cargos_abaixo():
    host = "hier.localhost"
    clinica = _criar_clinica("hier_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(
                email="gerente@c.com", password="Senha12345", papel="DENTISTA_GERENTE"
            )
            admin = Usuario.objects.create_user(
                email="admin@c.com", password="Senha12345", papel="ADMIN"
            )
            outro_g = Usuario.objects.create_user(
                email="g2@c.com", password="Senha12345", papel="DENTISTA_GERENTE"
            )
            dent = Usuario.objects.create_user(
                email="d@c.com", password="Senha12345", papel="DENTISTA"
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

        def criar(papel):
            return client.post(
                "/api/usuarios/",
                {
                    "email": f"n{papel}@c.com",
                    "nome_completo": "X",
                    "papel": papel,
                    "senha": "Senha12345",
                },
                format="json",
                HTTP_HOST=host,
            ).status_code

        # Gerente NÃO cria Admin nem Gerente; cria Dentista/Recepção
        assert criar("ADMIN") == 403
        assert criar("DENTISTA_GERENTE") == 403
        assert criar("DENTISTA") == 201
        # papel não-escalar (lista) é fail-closed -> 403, não 500
        assert criar(["DENTISTA", "ADMIN"]) == 403
        # Gerente NÃO edita/bloqueia Admin nem outro Gerente
        assert (
            client.patch(
                f"/api/usuarios/{admin.id}/", {"ativo": False}, format="json", HTTP_HOST=host
            ).status_code
            == 403
        )
        assert (
            client.patch(
                f"/api/usuarios/{outro_g.id}/", {"ativo": False}, format="json", HTTP_HOST=host
            ).status_code
            == 403
        )
        # Gerente edita um Dentista (cargo abaixo)
        assert (
            client.patch(
                f"/api/usuarios/{dent.id}/", {"ativo": False}, format="json", HTTP_HOST=host
            ).status_code
            == 200
        )
        # ...mas NÃO pode promovê-lo ao seu nível (Gerente)
        assert (
            client.patch(
                f"/api/usuarios/{dent.id}/",
                {"papel": "DENTISTA_GERENTE"},
                format="json",
                HTTP_HOST=host,
            ).status_code
            == 403
        )
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_auto_edicao_so_nome_e_senha():
    """O próprio usuário só edita nome e senha — não muda o próprio papel nem se bloqueia."""
    host = "self.localhost"
    clinica = _criar_clinica("self_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            gerente = Usuario.objects.create_user(
                email="g@c.com",
                password="Senha12345",
                papel="DENTISTA_GERENTE",
                nome_completo="Gil",
            )

        cache.clear()
        client = APIClient()
        tok = client.post(
            "/api/auth/token/",
            {"email": "g@c.com", "password": "Senha12345"},
            format="json",
            HTTP_HOST=host,
        ).json()["access"]
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
        base = f"/api/usuarios/{gerente.id}/"

        # Editar o próprio nome e senha -> 200
        assert (
            client.patch(
                base,
                {"nome_completo": "Gil Novo", "senha": "NovaSenha987"},
                format="json",
                HTTP_HOST=host,
            ).status_code
            == 200
        )
        # Alterar o próprio papel -> 403
        assert (
            client.patch(base, {"papel": "ADMIN"}, format="json", HTTP_HOST=host).status_code == 403
        )
        # Bloquear a si mesmo -> 403
        assert (
            client.patch(base, {"ativo": False}, format="json", HTTP_HOST=host).status_code == 403
        )

        with schema_context(clinica.schema_name):
            u = Usuario.objects.get(id=gerente.id)
            assert u.nome_completo == "Gil Novo"
            assert u.check_password("NovaSenha987")
            assert u.papel == "DENTISTA_GERENTE"  # inalterado
            assert u.is_active is True  # não se bloqueou
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()
