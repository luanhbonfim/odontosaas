"""Testes do agendamento de consulta (API + verificação de conflito de horário)."""

from datetime import timedelta

import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _base(client, host, cro="CRO-1", cpf="11122233344"):
    paciente = client.post(
        "/api/pacientes/",
        {"nome_completo": "Paciente", "cpf": cpf},
        format="json",
        HTTP_HOST=host,
    ).json()
    dentista = client.post(
        "/api/dentistas/",
        {"nome_completo": "Dentista", "cro": cro},
        format="json",
        HTTP_HOST=host,
    ).json()
    return paciente["id"], dentista["id"]


@pytest.mark.django_db(transaction=True)
def test_agendamento_e_conflito_de_horario():
    host = "agendamento.localhost"
    clinica = _criar_clinica("agendamento_tenant", host)
    client = APIClient()
    try:
        pac, den = _base(client, host)
        pac2, den2 = _base(client, host, cro="CRO-2", cpf="55566677788")

        inicio = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        fim = inicio + timedelta(minutes=30)

        def agendar(dentista, ini, f, paciente=pac):
            return client.post(
                "/api/consultas/",
                {
                    "paciente": paciente,
                    "dentista": dentista,
                    "inicio": ini.isoformat(),
                    "fim": f.isoformat(),
                },
                format="json",
                HTTP_HOST=host,
            )

        # 1) Agenda ok
        assert agendar(den, inicio, fim).status_code == 201

        # 2) Sobreposição no mesmo dentista -> 400
        resp = agendar(den, inicio + timedelta(minutes=15), fim + timedelta(minutes=15))
        assert resp.status_code == 400

        # 3) Mesmo horário, dentista diferente -> 201 (sem conflito)
        assert agendar(den2, inicio, fim, paciente=pac2).status_code == 201

        # 4) Horário adjacente (sem sobreposição) no mesmo dentista -> 201
        assert agendar(den, fim, fim + timedelta(minutes=30)).status_code == 201

        # 5) fim <= inicio -> 400
        resp = agendar(den, inicio, inicio)
        assert resp.status_code == 400
        assert "fim" in resp.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_consulta_cancelada_nao_bloqueia_horario():
    host = "cancelada.localhost"
    clinica = _criar_clinica("cancelada_tenant", host)
    client = APIClient()
    try:
        pac, den = _base(client, host)
        inicio = (timezone.now() + timedelta(days=2)).replace(microsecond=0)
        fim = inicio + timedelta(minutes=30)

        c1 = client.post(
            "/api/consultas/",
            {
                "paciente": pac,
                "dentista": den,
                "inicio": inicio.isoformat(),
                "fim": fim.isoformat(),
            },
            format="json",
            HTTP_HOST=host,
        ).json()
        # Cancela a primeira
        client.patch(
            f"/api/consultas/{c1['id']}/",
            {"status": "CANCELADA"},
            format="json",
            HTTP_HOST=host,
        )
        # Agora o mesmo horário fica livre -> 201
        resp = client.post(
            "/api/consultas/",
            {
                "paciente": pac,
                "dentista": den,
                "inicio": inicio.isoformat(),
                "fim": fim.isoformat(),
            },
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 201
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_excluir_so_agendada_e_campo_convenio():
    host = "delcons.localhost"
    clinica = _criar_clinica("delcons_tenant", host)
    client = APIClient()
    try:
        pac, den = _base(client, host)
        inicio = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        fim = inicio + timedelta(minutes=30)

        def agendar(ini=inicio, f=fim):
            return client.post(
                "/api/consultas/",
                {
                    "paciente": pac,
                    "dentista": den,
                    "inicio": ini.isoformat(),
                    "fim": f.isoformat(),
                },
                format="json",
                HTTP_HOST=host,
            ).json()

        # AGENDADA -> exclui (204)
        c1 = agendar()
        assert "convenio" in c1 and c1["convenio"] is None and "convenio_nome" in c1
        assert client.delete(f"/api/consultas/{c1['id']}/", HTTP_HOST=host).status_code == 204

        # REALIZADA -> não pode excluir (400)
        c2 = agendar()
        for novo in ("EM_ATENDIMENTO", "REALIZADA"):
            client.patch(
                f"/api/consultas/{c2['id']}/", {"status": novo}, format="json", HTTP_HOST=host
            )
        assert client.delete(f"/api/consultas/{c2['id']}/", HTTP_HOST=host).status_code == 400

        # CANCELADA -> também pode excluir (204) (outro horário: o de c2 ficou ocupado/REALIZADA)
        c3 = agendar(ini=fim, f=fim + timedelta(minutes=30))
        client.patch(f"/api/consultas/{c3['id']}/", {"status": "CANCELADA"}, format="json", HTTP_HOST=host)
        assert client.delete(f"/api/consultas/{c3['id']}/", HTTP_HOST=host).status_code == 204
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_excluir_consulta_cancelada_bloqueada_por_lancamento_pago():
    """Consulta cancelada com lançamento financeiro já PAGO (ex.: estornada por engano
    depois de recebida) não pode ser excluída — o vínculo é dado real, não formalidade."""
    from apps.financeiro.models import LancamentoFinanceiro

    host = "delcons-pago.localhost"
    clinica = _criar_clinica("delcons_pago_tenant", host)
    client = APIClient()
    try:
        pac, den = _base(client, host)
        inicio = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        fim = inicio + timedelta(minutes=30)

        consulta = client.post(
            "/api/consultas/",
            {
                "paciente": pac,
                "dentista": den,
                "inicio": inicio.isoformat(),
                "fim": fim.isoformat(),
                "valor": "150.00",
            },
            format="json",
            HTTP_HOST=host,
        ).json()

        for novo in ("EM_ATENDIMENTO", "REALIZADA"):
            client.patch(
                f"/api/consultas/{consulta['id']}/", {"status": novo}, format="json", HTTP_HOST=host
            )

        LancamentoFinanceiro.objects.filter(consulta_id=consulta["id"]).update(
            status=LancamentoFinanceiro.Status.PAGO
        )

        # Estorna por engano: volta para CANCELADA, mas o lançamento PAGO não é mexido
        resp_estorno = client.post(f"/api/consultas/{consulta['id']}/estornar/", HTTP_HOST=host)
        assert resp_estorno.status_code == 200
        assert resp_estorno.json()["status"] == "CANCELADA"

        resp_delete = client.delete(f"/api/consultas/{consulta['id']}/", HTTP_HOST=host)
        assert resp_delete.status_code == 400
        assert "pago" in resp_delete.json()["detail"].lower()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_ficha_da_consulta_dentes_e_anotacoes():
    """A ficha (odontograma + anotações) faz round-trip pela API."""
    host = "ficha.localhost"
    clinica = _criar_clinica("ficha_tenant", host)
    client = APIClient()
    try:
        pac, den = _base(client, host)
        inicio = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        fim = inicio + timedelta(minutes=30)

        c = client.post(
            "/api/consultas/",
            {
                "paciente": pac,
                "dentista": den,
                "inicio": inicio.isoformat(),
                "fim": fim.isoformat(),
            },
            format="json",
            HTTP_HOST=host,
        ).json()
        # Recém-criada: ficha vazia.
        assert c["dentes"] == [] and c["anotacoes"] == ""

        dentes = [
            {"dente": 44, "procedimento": "Restauração"},
            {"dente": 22, "procedimento": ""},
        ]
        resp = client.patch(
            f"/api/consultas/{c['id']}/",
            {"dentes": dentes, "anotacoes": "Restauração no 44."},
            format="json",
            HTTP_HOST=host,
        )
        assert resp.status_code == 200
        corpo = resp.json()
        assert corpo["dentes"] == dentes
        assert corpo["anotacoes"] == "Restauração no 44."
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
