"""Testes do model Usuario custom (login por e-mail, papel) — app usuarios."""

import pytest
from django.contrib.auth import get_user_model
from django_tenants.utils import schema_context

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
    assert valores == {"ADMIN", "DENTISTA", "RECEPCAO", "FINANCEIRO"}


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
