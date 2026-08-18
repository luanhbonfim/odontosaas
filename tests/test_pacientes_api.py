"""Testes da API REST de Paciente (CRUD + validação de CPF único)."""

import pytest
from django.db import connection
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_crud_paciente_e_cpf_unico():
    host = "apipacientes.localhost"
    clinica = _criar_clinica("api_pacientes", host)
    client = APIClient()
    try:
        # CREATE
        resp = client.post(
            "/api/pacientes/",
            {
                "nome_completo": "Maria Souza",
                "cpf": "12345678901",
                "telefone_whatsapp": "11988887777",
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        pid = resp.json()["id"]

        # LIST (paginada: {count, next, previous, results})
        resp = client.get("/api/pacientes/", HTTP_HOST=host)
        assert resp.status_code == 200
        corpo = resp.json()
        assert corpo["count"] == 1
        assert len(corpo["results"]) == 1

        # UPDATE (PATCH)
        resp = client.patch(
            f"/api/pacientes/{pid}/",
            {"email": "maria@x.com"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "maria@x.com"

        # CPF duplicado -> 400 com erro em 'cpf'
        resp = client.post(
            "/api/pacientes/",
            {"nome_completo": "Outra Maria", "cpf": "12345678901"},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 400
        assert "cpf" in resp.json()

        # Sem CPF -> 400 (a API exige CPF, mesmo o model permitindo null)
        resp = client.post(
            "/api/pacientes/", {"nome_completo": "Sem CPF"}, format="json", HTTP_HOST=host
        )
        assert resp.status_code == 400 and "cpf" in resp.json()

        # DELETE
        resp = client.delete(f"/api/pacientes/{pid}/", HTTP_HOST=host)
        assert resp.status_code == 204
        assert client.get("/api/pacientes/", HTTP_HOST=host).json()["count"] == 0
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_dentista_ve_apenas_seus_pacientes():
    """Escopo row-level: DENTISTA vê só responsável+com consulta; Gerente vê todos."""
    from datetime import timedelta

    from django.contrib.auth import get_user_model
    from django.core.cache import cache
    from django.utils import timezone
    from django_tenants.utils import schema_context

    from apps.agenda.models import Consulta
    from apps.dentistas.models import Dentista
    from apps.pacientes.models import Paciente
    from apps.usuarios.perfis import sincronizar_grupos

    Usuario = get_user_model()
    host = "escopo.localhost"
    clinica = _criar_clinica("escopo_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            dent1 = Dentista.objects.create(nome_completo="Dr. Um", cro="CRO-U1")
            u1 = Usuario.objects.create_user(
                email="d1@c.com", password="Senha12345", papel="DENTISTA"
            )
            dent1.usuario = u1
            dent1.save(update_fields=["usuario"])
            dent2 = Dentista.objects.create(nome_completo="Dr. Dois", cro="CRO-D2")
            Usuario.objects.create_user(
                email="g@c.com", password="Senha12345", papel="DENTISTA_GERENTE"
            )
            # Dentista com papel mas SEM cadastro vinculado (fail-closed).
            Usuario.objects.create_user(email="d0@c.com", password="Senha12345", papel="DENTISTA")

            Paciente.objects.create(
                nome_completo="Resp do 1", cpf="11111111111", dentista_responsavel=dent1
            )
            pb = Paciente.objects.create(nome_completo="Consulta com 1", cpf="22222222222")
            # Responsável é o dent2, mas compartilhado com o dent1 (ex.: dent2 de férias).
            comp = Paciente.objects.create(
                nome_completo="Compartilhado com 1", cpf="44444444444", dentista_responsavel=dent2
            )
            comp.dentistas_compartilhados.add(dent1)
            outro = Paciente.objects.create(
                nome_completo="Do outro", cpf="33333333333", dentista_responsavel=dent2
            )
            inicio = timezone.now() + timedelta(days=1)
            Consulta.objects.create(
                paciente=pb, dentista=dent1, inicio=inicio, fim=inicio + timedelta(minutes=30)
            )
            outro_id = outro.id

        def token(email):
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

        # Dentista 1: responsável + com consulta + compartilhado (3)
        r = token("d1@c.com").get("/api/pacientes/", HTTP_HOST=host).json()
        assert r["count"] == 3
        assert {p["nome_completo"] for p in r["results"]} == {
            "Resp do 1",
            "Consulta com 1",
            "Compartilhado com 1",
        }

        # Paciente fora do escopo -> 404 no detalhe
        assert (
            token("d1@c.com").get(f"/api/pacientes/{outro_id}/", HTTP_HOST=host).status_code == 404
        )

        # Dentista sem cadastro vinculado -> não vê nenhum (fail-closed)
        assert token("d0@c.com").get("/api/pacientes/", HTTP_HOST=host).json()["count"] == 0

        # Gerente: vê todos (4)
        assert token("g@c.com").get("/api/pacientes/", HTTP_HOST=host).json()["count"] == 4
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_dentista_nao_ve_relacoes_de_paciente_fora_do_escopo():
    """N1: planos/guias/consultas/anamneses também respeitam o escopo do dentista."""
    from datetime import timedelta

    from django.contrib.auth import get_user_model
    from django.core.cache import cache
    from django.utils import timezone
    from django_tenants.utils import schema_context

    from apps.agenda.models import Anamnese, Consulta
    from apps.dentistas.models import Dentista
    from apps.pacientes.models import Guia, Paciente, PlanoOdontologico
    from apps.usuarios.perfis import sincronizar_grupos

    Usuario = get_user_model()
    host = "escoporel.localhost"
    clinica = _criar_clinica("escoporel_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            d1 = Dentista.objects.create(nome_completo="D1", cro="REL-1")
            u1 = Usuario.objects.create_user(
                email="d1@c.com", password="Senha12345", papel="DENTISTA"
            )
            d1.usuario = u1
            d1.save(update_fields=["usuario"])
            d2 = Dentista.objects.create(nome_completo="D2", cro="REL-2")
            Usuario.objects.create_user(
                email="g@c.com", password="Senha12345", papel="DENTISTA_GERENTE"
            )

            pa = Paciente.objects.create(
                nome_completo="A", cpf="11111111111", dentista_responsavel=d1
            )
            pb = Paciente.objects.create(
                nome_completo="B", cpf="22222222222", dentista_responsavel=d2
            )
            plano_a = PlanoOdontologico.objects.create(paciente=pa, operadora="X")
            plano_b = PlanoOdontologico.objects.create(paciente=pb, operadora="Y")
            Guia.objects.create(plano=plano_a, numero_guia="GA", procedimento="p", valor=10)
            guia_b_id = Guia.objects.create(
                plano=plano_b, numero_guia="GB", procedimento="p", valor=10
            ).id
            inicio = timezone.now() + timedelta(days=1)
            Consulta.objects.create(
                paciente=pa, dentista=d1, inicio=inicio, fim=inicio + timedelta(minutes=30)
            )
            Consulta.objects.create(
                paciente=pb,
                dentista=d2,
                inicio=inicio + timedelta(hours=1),
                fim=inicio + timedelta(hours=1, minutes=30),
            )
            Anamnese.objects.create(paciente=pa, queixa_principal="x")
            anam_b_id = Anamnese.objects.create(paciente=pb, queixa_principal="y").id

        def token(email):
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

        # Dentista 1: só as relações do paciente A (1 de cada)
        d = token("d1@c.com")
        for rec in ("planos", "guias", "consultas", "anamneses"):
            assert len(d.get(f"/api/{rec}/", HTTP_HOST=host).json()) == 1, rec
        # Registro de outro paciente, por id -> 404 (não vaza)
        assert d.get(f"/api/anamneses/{anam_b_id}/", HTTP_HOST=host).status_code == 404
        assert d.get(f"/api/guias/{guia_b_id}/", HTTP_HOST=host).status_code == 404

        # Gerente: vê tudo (2 de cada)
        g = token("g@c.com")
        for rec in ("planos", "guias", "consultas", "anamneses"):
            assert len(g.get(f"/api/{rec}/", HTTP_HOST=host).json()) == 2, rec
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()


@pytest.mark.no_auto_auth
@pytest.mark.django_db(transaction=True)
def test_dentista_cadastra_vira_responsavel_e_nao_reatribui():
    """N2: dentista que cadastra é auto-atribuído responsável; não reatribui a outro."""
    from django.contrib.auth import get_user_model
    from django.core.cache import cache
    from django_tenants.utils import schema_context

    from apps.dentistas.models import Dentista
    from apps.usuarios.perfis import sincronizar_grupos

    Usuario = get_user_model()
    host = "n2.localhost"
    clinica = _criar_clinica("n2_tenant", host)
    try:
        with schema_context(clinica.schema_name):
            sincronizar_grupos()
            d1 = Dentista.objects.create(nome_completo="D1", cro="N2-1")
            u1 = Usuario.objects.create_user(
                email="d1@c.com", password="Senha12345", papel="DENTISTA"
            )
            d1.usuario = u1
            d1.save(update_fields=["usuario"])
            d1_id = d1.id
            d2_id = Dentista.objects.create(nome_completo="D2", cro="N2-2").id

        cache.clear()
        c = APIClient()
        tok = c.post(
            "/api/auth/token/",
            {"email": "d1@c.com", "password": "Senha12345"},
            format="json",
            HTTP_HOST=host,
        ).json()["access"]
        c.credentials(HTTP_AUTHORIZATION=f"Bearer {tok}")

        # Cria tentando atribuir a d2 -> ignorado; vira d1 (o criador)
        r = c.post(
            "/api/pacientes/",
            {"nome_completo": "Novo", "cpf": "11122233344", "dentista_responsavel": d2_id},
            format="json",
            HTTP_HOST=host,
        )
        assert r.status_code == 201, r.content
        assert r.json()["dentista_responsavel"] == d1_id
        pid = r.json()["id"]
        # E enxerga o paciente que criou
        assert c.get(f"/api/pacientes/{pid}/", HTTP_HOST=host).status_code == 200

        # Tenta reatribuir para d2 -> ignorado (continua d1)
        r = c.patch(
            f"/api/pacientes/{pid}/",
            {"dentista_responsavel": d2_id},
            format="json",
            HTTP_HOST=host,
        )
        assert r.status_code == 200 and r.json()["dentista_responsavel"] == d1_id
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
        cache.clear()


@pytest.mark.django_db(transaction=True)
def test_paciente_compartilhado_via_api():
    from django_tenants.utils import schema_context

    from apps.dentistas.models import Dentista

    host = "compart.localhost"
    clinica = _criar_clinica("compart_tenant", host)
    client = APIClient()  # superuser
    try:
        with schema_context(clinica.schema_name):
            did = Dentista.objects.create(nome_completo="Dra. Ana", cro="CRO-CMP").id

        resp = client.post(
            "/api/pacientes/",
            {"nome_completo": "X", "cpf": "11122233344", "dentistas_compartilhados": [did]},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201, resp.content
        assert resp.json()["dentistas_compartilhados"] == [did]
        assert resp.json()["dentistas_compartilhados_nomes"] == ["Dra. Ana"]
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_pacientes_filtros_status_e_responsavel():
    from django_tenants.utils import schema_context

    from apps.dentistas.models import Dentista
    from apps.pacientes.models import Paciente

    host = "filtros.localhost"
    clinica = _criar_clinica("filtros_tenant", host)
    client = APIClient()  # superuser (visão geral)
    try:
        with schema_context(clinica.schema_name):
            dent = Dentista.objects.create(nome_completo="Dr. F", cro="CRO-FIL")
            Paciente.objects.create(
                nome_completo="Ativo Com", cpf="11111111111", dentista_responsavel=dent
            )
            Paciente.objects.create(nome_completo="Ativo Sem", cpf="22222222222")
            Paciente.objects.create(nome_completo="Inativo", cpf="33333333333", ativo=False)
            did = dent.id

        def conta(qs=""):
            return client.get(f"/api/pacientes/{qs}", HTTP_HOST=host).json()["count"]

        assert conta() == 3
        assert conta("?ativo=true") == 2
        assert conta("?ativo=false") == 1
        assert conta(f"?dentista_responsavel={did}") == 1
        assert conta("?dentista_responsavel=nenhum") == 2  # os dois sem responsável
        # Ordenação (?ordering=) — o mais recente primeiro
        primeiro = client.get("/api/pacientes/?ordering=-criado_em", HTTP_HOST=host).json()[
            "results"
        ][0]["nome_completo"]
        assert primeiro == "Inativo"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_crud_plano_e_exclusao_protegida():
    host = "planos.localhost"
    clinica = _criar_clinica("api_planos", host)
    client = APIClient()
    try:
        pac = client.post(
            "/api/pacientes/",
            {"nome_completo": "Zé", "cpf": "11122233344"},
            format="json",
            HTTP_HOST=host,
        ).json()["id"]

        # CREATE plano
        plano = client.post(
            "/api/planos/",
            {"paciente": pac, "operadora": "Amil", "numero_carteirinha": "123"},
            format="json",
            HTTP_HOST=host,
        )
        assert plano.status_code == 201, plano.content
        plano_id = plano.json()["id"]
        assert plano.json()["status"] == "ATIVO"  # default

        # Guia vinculada (emitida com o plano ATIVO — P1)
        assert (
            client.post(
                "/api/guias/",
                {"plano": plano_id, "numero_guia": "G1", "procedimento": "X", "valor": "10.00"},
                format="json",
                HTTP_HOST=host,
            ).status_code
            == 201
        )

        # UPDATE (status) — mudar o status do plano é permitido (não é emissão de guia)
        upd = client.patch(
            f"/api/planos/{plano_id}/",
            {"status": "SUSPENSO"},
            format="json",
            HTTP_HOST=host,
        )
        assert upd.status_code == 200 and upd.json()["status"] == "SUSPENSO"

        # Excluir plano com guia -> 400 (PROTECT tratado)
        protegido = client.delete(f"/api/planos/{plano_id}/", HTTP_HOST=host)
        assert protegido.status_code == 400
        assert "detail" in protegido.json()

        # Plano sem guias -> exclui (204)
        livre = client.post(
            "/api/planos/",
            {"paciente": pac, "operadora": "Bradesco"},
            format="json",
            HTTP_HOST=host,
        ).json()["id"]
        assert client.delete(f"/api/planos/{livre}/", HTTP_HOST=host).status_code == 204
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_pacientes_paginacao_busca_e_ordenacao():
    host = "pagpacientes.localhost"
    clinica = _criar_clinica("pag_pacientes", host)
    client = APIClient()
    try:
        from django_tenants.utils import schema_context

        from apps.pacientes.models import Paciente

        with schema_context(clinica.schema_name):
            for i in range(25):
                Paciente.objects.create(nome_completo=f"Paciente {i:02d}", cpf=f"{i:011d}")
            Paciente.objects.create(nome_completo="Zé Buscável", cpf="99988877766")

        # Página 1: 20 itens, count total = 26, com "next"
        p1 = client.get("/api/pacientes/", HTTP_HOST=host).json()
        assert p1["count"] == 26
        assert len(p1["results"]) == 20
        assert p1["next"] is not None
        assert p1["previous"] is None

        # Página 2: restante (6), sem "next"
        p2 = client.get("/api/pacientes/?page=2", HTTP_HOST=host).json()
        assert len(p2["results"]) == 6
        assert p2["next"] is None

        # page_size customizado
        assert len(client.get("/api/pacientes/?page_size=5", HTTP_HOST=host).json()["results"]) == 5

        # Busca por nome (?search=)
        busca = client.get("/api/pacientes/?search=Buscável", HTTP_HOST=host).json()
        assert busca["count"] == 1
        assert busca["results"][0]["nome_completo"] == "Zé Buscável"

        # Busca por CPF (dígitos)
        assert client.get("/api/pacientes/?search=99988877766", HTTP_HOST=host).json()["count"] == 1

        # Ordenação decrescente por nome
        desc = client.get("/api/pacientes/?ordering=-nome_completo", HTTP_HOST=host).json()
        assert desc["results"][0]["nome_completo"] == "Zé Buscável"
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_paciente_expoe_idade():
    host = "idadepac.localhost"
    clinica = _criar_clinica("idade_pac_tenant", host)
    client = APIClient()
    try:
        com = client.post(
            "/api/pacientes/",
            {"nome_completo": "Zé", "cpf": "11122233344", "data_nascimento": "2000-01-01"},
            format="json",
            HTTP_HOST=host,
        )
        assert com.status_code == 201, com.content
        assert com.json()["idade"] >= 26  # nascido em 2000

        sem = client.post(
            "/api/pacientes/",
            {"nome_completo": "Ana", "cpf": "55566677788"},
            format="json",
            HTTP_HOST=host,
        )
        assert sem.json()["idade"] is None  # sem data_nascimento
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
