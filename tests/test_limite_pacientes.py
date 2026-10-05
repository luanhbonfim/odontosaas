"""Sprint P — limite de pacientes ATIVOS do plano (cadastro, reativação, cota, importação)."""

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.pacientes.models import Paciente
from apps.plataforma.models import PlanoAssinatura
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.perfis import sincronizar_grupos

Usuario = get_user_model()
HOST = "limpac.localhost"


def _clinica(schema, dominio, limite):
    plano = PlanoAssinatura.objects.create(
        nome=f"Plano {schema}", preco_mensal="10", limite_pacientes_ativos=limite
    )
    clinica = Clinica(schema_name=schema, nome_fantasia=schema, plano_assinatura=plano)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _cliente(host, email):
    cache.clear()
    c = APIClient()
    tok = c.post(
        "/api/auth/token/", {"email": email, "password": "Senha12345"}, format="json", HTTP_HOST=host
    ).json()["access"]
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")
    return c


def _novo(cliente, nome, cpf, **extra):
    return cliente.post(
        "/api/pacientes/", {"nome_completo": nome, "cpf": cpf, **extra}, format="json", HTTP_HOST=HOST
    )


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_cadastro_reativacao_cota_e_vaga_liberada():
    clinica = _clinica("lim_pac", HOST, limite=2)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(email="adm@c.com", password="Senha12345", papel="ADMIN")
        c = _cliente(HOST, "adm@c.com")

        # Abaixo do limite: ok. Cota reflete o uso.
        assert _novo(c, "Ana", "11122233301").status_code == 201
        cota = c.get("/api/pacientes/cota/", HTTP_HOST=HOST).json()
        assert (cota["atual"], cota["limite"], cota["atingiu_limite"]) == (1, 2, False)
        assert cota["proximo_do_limite"] is False  # 50%

        # No limite: o 2º entra e fecha a cota (100% -> aviso de proximidade).
        segunda = _novo(c, "Bia", "11122233302")
        assert segunda.status_code == 201
        cota = c.get("/api/pacientes/cota/", HTTP_HOST=HOST).json()
        assert cota["atingiu_limite"] is True and cota["proximo_do_limite"] is True
        assert cota["percentual"] == 100.0

        # Acima do limite: bloqueia com código estável + limite/atual para o CTA.
        r = _novo(c, "Caio", "11122233303")
        assert r.status_code == 400
        corpo = r.json()
        assert corpo["codigo"] == "limite_pacientes"
        assert (corpo["limite"], corpo["atual"]) == (2, 2)
        assert "upgrade" in corpo["detail"]

        # Cadastrar já INATIVO não ocupa vaga, mesmo no limite.
        inativo = _novo(c, "Duda", "11122233304", ativo=False)
        assert inativo.status_code == 201
        inativo_id = inativo.json()["id"]

        # Reativar com a cota cheia é bloqueado...
        r = c.patch(f"/api/pacientes/{inativo_id}/", {"ativo": True}, format="json", HTTP_HOST=HOST)
        assert r.status_code == 400 and r.json()["codigo"] == "limite_pacientes"

        # ...mas editar OUTROS campos de paciente já ativo (no limite) segue permitido.
        ana = c.get("/api/pacientes/?search=Ana", HTTP_HOST=HOST).json()["results"][0]
        r = c.patch(f"/api/pacientes/{ana['id']}/", {"telefone_whatsapp": "11999990000"}, format="json", HTTP_HOST=HOST)
        assert r.status_code == 200, r.content

        # Inativar libera a vaga: agora reativar a Duda e cadastrar passam a respeitar a nova conta.
        r = c.patch(f"/api/pacientes/{ana['id']}/", {"ativo": False}, format="json", HTTP_HOST=HOST)
        assert r.status_code == 200
        assert c.get("/api/pacientes/cota/", HTTP_HOST=HOST).json()["atual"] == 1
        r = c.patch(f"/api/pacientes/{inativo_id}/", {"ativo": True}, format="json", HTTP_HOST=HOST)
        assert r.status_code == 200, r.content
        # Cota cheia de novo (Bia + Duda): novo cadastro volta a ser bloqueado.
        assert _novo(c, "Eva", "11122233305").status_code == 400
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        PlanoAssinatura.objects.filter(nome="Plano lim_pac").delete()


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_plano_ilimitado_nao_bloqueia_e_meu_plano_usa_o_mesmo_limite():
    clinica = _clinica("lim_ilim", "limilim.localhost", limite=None)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(email="adm@c.com", password="Senha12345", papel="ADMIN")
            for i in range(5):
                Paciente.objects.create(nome_completo=f"P{i}", cpf=f"2223334445{i}")
        c = _cliente("limilim.localhost", "adm@c.com")
        cota = c.get("/api/pacientes/cota/", HTTP_HOST="limilim.localhost").json()
        assert cota["ilimitado"] is True and cota["limite"] is None
        assert cota["atingiu_limite"] is False and cota["proximo_do_limite"] is False
        r = c.post(
            "/api/pacientes/",
            {"nome_completo": "Mais um", "cpf": "22233344499"},
            format="json",
            HTTP_HOST="limilim.localhost",
        )
        assert r.status_code == 201
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        PlanoAssinatura.objects.filter(nome="Plano lim_ilim").delete()


@pytest.mark.django_db(transaction=True)
def test_clinica_acima_da_cota_mantem_pacientes_mas_nao_cadastra_mais():
    """Trocou para plano menor: nada é desativado à força; só novos cadastros param."""
    from apps.pacientes.limites import cota_pacientes

    clinica = _clinica("lim_acima", "limacima.localhost", limite=1)
    try:
        with schema_context(clinica.schema_name):
            Paciente.objects.create(nome_completo="A", cpf="33344455501")
            Paciente.objects.create(nome_completo="B", cpf="33344455502")
            cota = cota_pacientes(clinica)
            assert cota["atual"] == 2 and cota["atingiu_limite"] is True
            assert cota["percentual"] == 200.0
            assert Paciente.objects.filter(ativo=True).count() == 2
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        PlanoAssinatura.objects.filter(nome="Plano lim_acima").delete()


@pytest.mark.django_db(transaction=True)
def test_importacao_google_no_limite_nao_cria_paciente():
    """Evento do Google com paciente novo não é importado quando a cota está cheia —
    e funciona dentro de `schema_context` (onde `connection.tenant` é um objeto falso)."""
    from apps.dentistas.models import Dentista
    from apps.integracoes.google_calendar import _importar_evento
    from apps.integracoes.models import CredencialGoogleCalendar

    clinica = _clinica("lim_goog", "limgoog.localhost", limite=1)
    try:
        with schema_context(clinica.schema_name):
            Paciente.objects.create(nome_completo="Existente", cpf="44455566601")
            dentista = Dentista.objects.create(nome_completo="D", cro="LG-1")
            cred = CredencialGoogleCalendar.objects.create(
                dentista=dentista, access_token="t", refresh_token="r", scope="s"
            )
            item = {
                "id": "ev-1",
                "summary": "Fulano Novo",
                "description": "tel 11 98888-7777",
                "start": {"dateTime": "2026-12-01T10:00:00-03:00"},
                "end": {"dateTime": "2026-12-01T10:30:00-03:00"},
            }
            assert _importar_evento(item, cred) is None
            assert not Paciente.objects.filter(nome_completo="Fulano Novo").exists()

            # Com vaga (limite maior), o mesmo evento importa normalmente.
            plano = clinica.plano_assinatura
            plano.limite_pacientes_ativos = 5
            plano.save()
            assert _importar_evento(item, cred) is not None
            assert Paciente.objects.filter(nome_completo="Fulano Novo").exists()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        PlanoAssinatura.objects.filter(nome="Plano lim_goog").delete()
