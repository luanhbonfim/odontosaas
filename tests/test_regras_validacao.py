"""Validações de regra de negócio: guia em plano não-ATIVO (P1), valor negativo
(N5) e anamnese vinculada a consulta de outro paciente (G1)."""

import pytest
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework.test import APIClient

from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_validacoes_guia_e_anamnese():
    from datetime import timedelta

    from django.utils import timezone

    from apps.agenda.models import Consulta
    from apps.dentistas.models import Dentista
    from apps.pacientes.models import Paciente, PlanoOdontologico

    host = "regras.localhost"
    clinica = _criar_clinica("regras_tenant", host)
    client = APIClient()  # auto-autenticado (superuser)
    try:
        with schema_context(clinica.schema_name):
            pa = Paciente.objects.create(nome_completo="A", cpf="11111111111")
            pb = Paciente.objects.create(nome_completo="B", cpf="22222222222")
            den = Dentista.objects.create(nome_completo="D", cro="REG-1")
            plano_ativo = PlanoOdontologico.objects.create(
                paciente=pa, operadora="X", status=PlanoOdontologico.Status.ATIVO
            )
            plano_susp = PlanoOdontologico.objects.create(
                paciente=pa, operadora="X", status=PlanoOdontologico.Status.SUSPENSO
            )
            ini = timezone.now() + timedelta(days=1)
            consulta_b = Consulta.objects.create(
                paciente=pb, dentista=den, inicio=ini, fim=ini + timedelta(minutes=30)
            )
            ativo_id, susp_id, pa_id, cb_id = (
                plano_ativo.id,
                plano_susp.id,
                pa.id,
                consulta_b.id,
            )

        def post_guia(plano, numero, valor):
            return client.post(
                "/api/guias/",
                {"plano": plano, "numero_guia": numero, "procedimento": "p", "valor": valor},
                format="json",
                HTTP_HOST=host,
            )

        # P1: emitir guia em plano SUSPENSO -> 400
        r = post_guia(susp_id, "G1", "10")
        assert r.status_code == 400 and "plano" in r.json()

        # N5: valor negativo -> 400
        r = post_guia(ativo_id, "G2", "-5")
        assert r.status_code == 400 and "valor" in r.json()

        # Guia válida em plano ATIVO -> 201
        assert post_guia(ativo_id, "G3", "10").status_code == 201

        # G1: anamnese com consulta de OUTRO paciente -> 400
        r = client.post(
            "/api/anamneses/",
            {"paciente": pa_id, "consulta": cb_id, "queixa_principal": "x"},
            format="json",
            HTTP_HOST=host,
        )
        assert r.status_code == 400 and "consulta" in r.json()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_n3_nao_agenda_no_passado_mas_permite_lancar_realizada():
    """N3: agendar (AGENDADA) no passado é bloqueado; lançar atendimento já ocorrido não."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.dentistas.models import Dentista
    from apps.pacientes.models import Paciente

    host = "n3.localhost"
    clinica = _criar_clinica("n3_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            pac = Paciente.objects.create(nome_completo="P", cpf="11111111111")
            den = Dentista.objects.create(nome_completo="D", cro="N3-1")
            pac_id, den_id = pac.id, den.id

        passado = (timezone.now() - timedelta(days=1)).replace(microsecond=0)

        def post(status_, ini):
            corpo = {
                "paciente": pac_id,
                "dentista": den_id,
                "inicio": ini.isoformat(),
                "fim": (ini + timedelta(minutes=30)).isoformat(),
            }
            if status_:
                corpo["status"] = status_
            return client.post("/api/consultas/", corpo, format="json", HTTP_HOST=host)

        # Agendar no passado (AGENDADA) -> 400
        r = post(None, passado)
        assert r.status_code == 400 and "inicio" in r.json()

        # Lançar um atendimento já ocorrido (REALIZADA/FALTOU) no passado -> 201
        assert post("REALIZADA", passado).status_code == 201
        assert post("FALTOU", passado - timedelta(hours=2)).status_code == 201
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_n8_bloqueia_sobreposicao_do_paciente():
    """N8: o paciente não pode ter duas consultas sobrepostas (mesmo com dentistas diferentes)."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.dentistas.models import Dentista
    from apps.pacientes.models import Paciente

    host = "n8.localhost"
    clinica = _criar_clinica("n8_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            pac = Paciente.objects.create(nome_completo="P", cpf="11111111111")
            d1 = Dentista.objects.create(nome_completo="D1", cro="N8-1")
            d2 = Dentista.objects.create(nome_completo="D2", cro="N8-2")
            pac_id, d1_id, d2_id = pac.id, d1.id, d2.id

        ini = (timezone.now() + timedelta(days=1)).replace(microsecond=0)
        fim = ini + timedelta(minutes=30)

        def post(dentista):
            return client.post(
                "/api/consultas/",
                {
                    "paciente": pac_id,
                    "dentista": dentista,
                    "inicio": ini.isoformat(),
                    "fim": fim.isoformat(),
                },
                format="json",
                HTTP_HOST=host,
            )

        assert post(d1_id).status_code == 201
        # Mesmo paciente, dentista diferente, mesmo horário -> bloqueia (N8).
        r = post(d2_id)
        assert r.status_code == 400 and "paciente" in str(r.json()).lower()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_plano_vencido_derivado_no_serializer():
    """O campo `vencido` do plano é derivado da validade (não escolhido)."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.convenios.models import Convenio
    from apps.pacientes.models import Paciente, PlanoOdontologico

    host = "planovenc.localhost"
    clinica = _criar_clinica("planovenc_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            pac = Paciente.objects.create(nome_completo="P", cpf="11122233344")
            conv = Convenio.objects.create(nome="Amil")
            venc = PlanoOdontologico.objects.create(
                paciente=pac,
                convenio=conv,
                operadora="Amil",
                validade=timezone.localdate() - timedelta(days=1),
            )
            vig = PlanoOdontologico.objects.create(
                paciente=pac,
                convenio=conv,
                operadora="Amil",
                validade=timezone.localdate() + timedelta(days=30),
            )
            venc_id, vig_id = venc.id, vig.id

        assert client.get(f"/api/planos/{venc_id}/", HTTP_HOST=host).json()["vencido"] is True
        assert client.get(f"/api/planos/{vig_id}/", HTTP_HOST=host).json()["vencido"] is False
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_bloqueia_agendar_com_convenio_vencido():
    """Consulta por convênio cujo plano do paciente está vencido -> 400."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.convenios.models import Convenio
    from apps.dentistas.models import Dentista
    from apps.pacientes.models import Paciente, PlanoOdontologico

    host = "convenc.localhost"
    clinica = _criar_clinica("convenc_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            pac = Paciente.objects.create(nome_completo="P", cpf="11122233344")
            den = Dentista.objects.create(nome_completo="D", cro="CE-1")
            conv = Convenio.objects.create(nome="Amil")
            PlanoOdontologico.objects.create(
                paciente=pac,
                convenio=conv,
                operadora="Amil",
                validade=timezone.localdate() - timedelta(days=1),  # vencido
            )
            pac_id, den_id, conv_id = pac.id, den.id, conv.id

        ini = (timezone.now() + timedelta(days=1)).replace(microsecond=0)

        def post(corpo_extra):
            return client.post(
                "/api/consultas/",
                {
                    "paciente": pac_id,
                    "dentista": den_id,
                    "inicio": ini.isoformat(),
                    "fim": (ini + timedelta(minutes=30)).isoformat(),
                    "valor": "100",
                    **corpo_extra,
                },
                format="json",
                HTTP_HOST=host,
            )

        # por convênio vencido -> 400
        r = post({"convenio": conv_id})
        assert r.status_code == 400 and "convenio" in r.json()
        # particular no mesmo horário (o anterior não foi criado) -> 201
        assert post({}).status_code == 201
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_n4_bloqueia_guia_em_plano_vencido():
    """N4: não emite guia num plano com validade vencida."""
    from datetime import timedelta

    from django.utils import timezone

    from apps.pacientes.models import Paciente, PlanoOdontologico

    host = "n4.localhost"
    clinica = _criar_clinica("n4_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            pac = Paciente.objects.create(nome_completo="P", cpf="11111111111")
            vencido = PlanoOdontologico.objects.create(
                paciente=pac, operadora="X", validade=timezone.localdate() - timedelta(days=1)
            )
            vigente = PlanoOdontologico.objects.create(
                paciente=pac, operadora="X", validade=timezone.localdate() + timedelta(days=30)
            )
            venc_id, vig_id = vencido.id, vigente.id

        def post_guia(plano, numero):
            return client.post(
                "/api/guias/",
                {"plano": plano, "numero_guia": numero, "procedimento": "p", "valor": "10"},
                format="json",
                HTTP_HOST=host,
            )

        r = post_guia(venc_id, "GV")
        assert r.status_code == 400 and "plano" in r.json()
        assert post_guia(vig_id, "GG").status_code == 201
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_nao_exclui_dentista_com_pacientes_vinculados():
    """Excluir dentista responsável/compartilhado é bloqueado até reatribuir."""
    from apps.dentistas.models import Dentista
    from apps.pacientes.models import Paciente

    host = "deldent.localhost"
    clinica = _criar_clinica("deldent_tenant", host)
    client = APIClient()
    try:
        with schema_context(clinica.schema_name):
            den = Dentista.objects.create(nome_completo="D", cro="DEL-1")
            outro = Dentista.objects.create(nome_completo="O", cro="DEL-2")
            pac = Paciente.objects.create(
                nome_completo="P", cpf="11111111111", dentista_responsavel=den
            )
            den_id, outro_id, pac_id = den.id, outro.id, pac.id

        # Responsável por um paciente -> 400
        assert client.delete(f"/api/dentistas/{den_id}/", HTTP_HOST=host).status_code == 400

        # Reatribui e então exclui -> 204
        client.patch(
            f"/api/pacientes/{pac_id}/",
            {"dentista_responsavel": outro_id},
            format="json",
            HTTP_HOST=host,
        )
        assert client.delete(f"/api/dentistas/{den_id}/", HTTP_HOST=host).status_code == 204
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
