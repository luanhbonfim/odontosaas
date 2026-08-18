"""Testes do model Usuario custom (login por e-mail, papel) — app usuarios."""

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio

Usuario = get_user_model()


# --- Configuração (sem banco) ---
def test_auth_user_model(settings):
    assert settings.AUTH_USER_MODEL == "usuarios.Usuario"


def test_login_por_email():
    assert Usuario.USERNAME_FIELD == "email"
    campos = {f.name for f in Usuario._meta.get_fields()}
    assert "username" not in campos
    assert "papel" in campos


def test_papel_choices():
    valores = {c[0] for c in Usuario._meta.get_field("papel").choices}
    assert valores == {"ADMIN", "DENTISTA_GERENTE", "DENTISTA", "RECEPCAO"}


def test_str_usa_nome_ou_email():
    assert str(Usuario(email="a@b.com")) == "a@b.com"
    assert str(Usuario(email="a@b.com", nome_completo="Dra. Ana")) == "Dra. Ana"


def test_manager_exige_email():
    with pytest.raises(ValueError):
        Usuario.objects.create_user(email="", password="x")


def test_create_superuser_exige_flags():
    with pytest.raises(ValueError):
        Usuario.objects.create_superuser(email="a@b.com", password="x", is_staff=False)
    with pytest.raises(ValueError):
        Usuario.objects.create_superuser(email="a@b.com", password="x", is_superuser=False)


# --- Criação real dentro do schema de um tenant ---
@pytest.mark.django_db(transaction=True)
def test_criar_usuario_dentro_do_tenant():
    clinica = Clinica(schema_name="teste_usuarios", nome_fantasia="Clínica Teste")
    clinica.save()
    try:
        Dominio.objects.create(domain="teste-usuarios.localhost", tenant=clinica, is_primary=True)
        with schema_context(clinica.schema_name):
            user = Usuario.objects.create_user(
                email="dentista@clinica.com",
                password="senha-forte-123",
                papel=Usuario.Papel.DENTISTA,
                nome_completo="Dr. Fulano",
            )
            assert user.email == "dentista@clinica.com"
            assert user.check_password("senha-forte-123")
            assert user.papel == "DENTISTA"
            assert Usuario.objects.count() == 1
    finally:
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_criar_login_atrelado_a_dentista_pela_equipe():
    """Em Equipe cria-se o login e atrela-se um dentista; o vínculo pode ser
    trocado e desfeito (Dentista.usuario)."""
    from apps.dentistas.models import Dentista

    host = "equipe-vinc.localhost"
    clinica = Clinica(schema_name="equipe_vinc", nome_fantasia="Clínica")
    clinica.save()
    try:
        Dominio.objects.create(domain=host, tenant=clinica, is_primary=True)
        with schema_context(clinica.schema_name):
            dentista = Dentista.objects.create(nome_completo="Dra. Ana Lima", cro="CRO-V1")
            outro = Dentista.objects.create(nome_completo="Dr. Beto", cro="CRO-V2")

        client = APIClient()  # auto-autenticado (conftest, superuser)

        # Cria o login atrelando o dentista.
        criar = client.post(
            "/api/usuarios/",
            {
                "email": "ana@clinica.com",
                "nome_completo": "Dra. Ana Lima",
                "papel": "DENTISTA",
                "senha": "SenhaForte123",
                "dentista": dentista.id,
            },
            format="json",
            HTTP_HOST=host,
        )
        assert criar.status_code == 201, criar.content
        corpo = criar.json()
        usuario_id = corpo["id"]
        assert corpo["dentista_id"] == dentista.id
        assert corpo["dentista_nome"] == "Dra. Ana Lima"
        assert "senha" not in corpo  # nunca expõe a senha
        with schema_context(clinica.schema_name):
            assert Dentista.objects.get(id=dentista.id).usuario_id == usuario_id

        # Troca o vínculo para outro dentista -> o primeiro fica solto.
        patch = client.patch(
            f"/api/usuarios/{usuario_id}/",
            {"dentista": outro.id},
            format="json",
            HTTP_HOST=host,
        )
        assert patch.status_code == 200, patch.content
        with schema_context(clinica.schema_name):
            assert Dentista.objects.get(id=outro.id).usuario_id == usuario_id
            assert Dentista.objects.get(id=dentista.id).usuario_id is None

        # Desfaz o vínculo (dentista=null).
        client.patch(
            f"/api/usuarios/{usuario_id}/",
            {"dentista": None},
            format="json",
            HTTP_HOST=host,
        )
        with schema_context(clinica.schema_name):
            assert Dentista.objects.get(id=outro.id).usuario_id is None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_nao_atrela_dentista_ja_vinculado_a_outro_login():
    """Um dentista que já é o login de um usuário não pode ser atrelado a outro."""
    from apps.dentistas.models import Dentista

    host = "equipe-dup.localhost"
    clinica = Clinica(schema_name="equipe_dup", nome_fantasia="Clínica")
    clinica.save()
    try:
        Dominio.objects.create(domain=host, tenant=clinica, is_primary=True)
        with schema_context(clinica.schema_name):
            dentista = Dentista.objects.create(nome_completo="Dra. Ana", cro="CRO-D1")

        client = APIClient()

        def criar_login(email, dentista_id):
            return client.post(
                "/api/usuarios/",
                {
                    "email": email,
                    "nome_completo": "Login",
                    "papel": "DENTISTA",
                    "senha": "SenhaForte123",
                    "dentista": dentista_id,
                },
                format="json",
                HTTP_HOST=host,
            )

        # Primeiro login atrela o dentista (201).
        primeiro = criar_login("a@c.com", dentista.id)
        assert primeiro.status_code == 201, primeiro.content

        # Segundo login tentando o MESMO dentista -> 400 (bloqueado).
        segundo = criar_login("b@c.com", dentista.id)
        assert segundo.status_code == 400
        assert "dentista" in segundo.json()

        # O vínculo original permanece intacto.
        with schema_context(clinica.schema_name):
            assert Dentista.objects.get(id=dentista.id).usuario.email == "a@c.com"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
