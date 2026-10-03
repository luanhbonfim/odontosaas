"""Testes da Busca global (`apps.busca`)."""

from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.pacientes.models import Paciente
from apps.procedimentos.models import Procedimento
from apps.tenants.models import Clinica, Dominio
from apps.usuarios.perfis import sincronizar_grupos

Usuario = get_user_model()
SP = ZoneInfo("America/Sao_Paulo")


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
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


def _consulta(paciente, dentista, inicio, procedimento="", catalogo=None):
    return Consulta.objects.create(
        paciente=paciente,
        dentista=dentista,
        inicio=inicio,
        fim=inicio + timedelta(minutes=30),
        valor=Decimal("0"),
        procedimento=procedimento,
        procedimento_catalogo=catalogo,
    )


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_busca_pacientes_consultas_escopo_e_permissoes(django_assert_max_num_queries):
    host = "busca.localhost"
    clinica = _criar_clinica("busca_api", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(email="adm@c.com", password="Senha12345", papel="ADMIN")
            Usuario.objects.create_user(email="rec@c.com", password="Senha12345", papel="RECEPCAO")
            u1 = Usuario.objects.create_user(email="d1@c.com", password="Senha12345", papel="DENTISTA")
            Usuario.objects.create_user(email="semcad@c.com", password="Senha12345", papel="DENTISTA")
            d1 = Dentista.objects.create(nome_completo="Dr. Um", cro="BUS-1", usuario=u1)
            d2 = Dentista.objects.create(nome_completo="Dra. Dois", cro="BUS-2")
            ana = Paciente.objects.create(nome_completo="Ana Beatriz", cpf="11122233344", dentista_responsavel=d1)
            bia = Paciente.objects.create(nome_completo="Beatriz Souza", cpf="55566677788", dentista_responsavel=d2)
            Paciente.objects.create(nome_completo="Carlos", cpf="99988877766")
            limpeza = Procedimento.objects.create(nome="Limpeza profunda")
            agora = datetime(2026, 10, 7, 9, 0, tzinfo=SP)
            _consulta(ana, d1, agora, catalogo=limpeza)
            _consulta(bia, d2, agora + timedelta(hours=1), procedimento="Clareamento")
            # 8 pacientes "Zé ..." para o limite
            for i in range(8):
                Paciente.objects.create(nome_completo=f"Zé {i}", cpf=f"0000000000{i}")

        adm = _cliente(host, "adm@c.com")
        corpo = adm.get("/api/busca/?q=beatriz", HTTP_HOST=host).json()
        assert [p["nome_completo"] for p in corpo["pacientes"]] == ["Ana Beatriz", "Beatriz Souza"]
        assert {c["paciente_nome"] for c in corpo["consultas"]} == {"Ana Beatriz", "Beatriz Souza"}

        # case-insensitive/parcial; CPF com e sem máscara
        assert adm.get("/api/busca/?q=ANA", HTTP_HOST=host).json()["pacientes"][0]["id"] == ana.id
        for q in ("111.222.333", "11122233344", "222333"):
            ids = [p["id"] for p in adm.get(f"/api/busca/?q={q}", HTTP_HOST=host).json()["pacientes"]]
            assert ids == [ana.id], q
        # 2 dígitos não buscam CPF (só nome)
        assert adm.get("/api/busca/?q=11", HTTP_HOST=host).json()["pacientes"] == []

        # consulta casa por procedimento (catálogo e texto livre)
        por_cat = adm.get("/api/busca/?q=limpeza", HTTP_HOST=host).json()["consultas"]
        assert [c["procedimento"] for c in por_cat] == ["Limpeza profunda"]
        por_txt = adm.get("/api/busca/?q=clareamento", HTTP_HOST=host).json()["consultas"]
        assert por_txt[0]["dentista_nome"] == "Dra. Dois"

        # termo curto/vazio -> blocos vazios; limite de 6
        assert adm.get("/api/busca/?q=a", HTTP_HOST=host).json() == {"pacientes": [], "consultas": []}
        assert adm.get("/api/busca/", HTTP_HOST=host).json() == {"pacientes": [], "consultas": []}
        assert len(adm.get("/api/busca/?q=Zé", HTTP_HOST=host).json()["pacientes"]) == 6

        # 401 sem auth
        assert APIClient().get("/api/busca/?q=ana", HTTP_HOST=host).status_code == 401

        # Dentista: só o escopo dele (Ana é responsável; Bia é do outro; Carlos sem vínculo)
        d = _cliente(host, "d1@c.com").get("/api/busca/?q=beatriz", HTTP_HOST=host).json()
        assert [p["nome_completo"] for p in d["pacientes"]] == ["Ana Beatriz"]
        assert [c["paciente_nome"] for c in d["consultas"]] == ["Ana Beatriz"]
        assert _cliente(host, "d1@c.com").get("/api/busca/?q=carlos", HTTP_HOST=host).json()["pacientes"] == []
        # Dentista sem cadastro: fail-closed
        sc = _cliente(host, "semcad@c.com").get("/api/busca/?q=beatriz", HTTP_HOST=host).json()
        assert sc == {"pacientes": [], "consultas": []}

        # Recepção acessa ambos os blocos
        rec = _cliente(host, "rec@c.com").get("/api/busca/?q=beatriz", HTTP_HOST=host).json()
        assert rec["pacientes"] and rec["consultas"]

        # Nº de queries não cresce com o volume (2 buscas + auth/permissões)
        with django_assert_max_num_queries(12):
            adm.get("/api/busca/?q=beatriz", HTTP_HOST=host)
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_busca_bloco_nulo_sem_permissao_do_modulo():
    from apps.usuarios.models import PermissaoModuloPersonalizada  # noqa: PLC0415

    host = "busca2.localhost"
    clinica = _criar_clinica("busca_perm", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            Usuario.objects.create_user(email="rec@c.com", password="Senha12345", papel="RECEPCAO")
            Paciente.objects.create(nome_completo="Ana", cpf="11122233344")
        rec = _cliente(host, "rec@c.com")
        assert rec.get("/api/busca/?q=ana", HTTP_HOST=host).json()["pacientes"]
        assert PermissaoModuloPersonalizada is not None
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
