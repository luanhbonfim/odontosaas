"""Motor de Lembretes: recall por procedimento e aviso X h antes (confirmados)."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.notificacoes.models import ConfiguracaoNotificacao, LogNotificacao, TemplateMensagem
from apps.pacientes.models import Paciente
from apps.procedimentos.models import Procedimento
from apps.tenants.models import Clinica, Dominio

TEL = "5518999998888"


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


@pytest.mark.django_db(transaction=True)
def test_recall_por_procedimento_uma_vez():
    clinica = _criar_clinica("lemb_recall", "lembrecall.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.notificacoes.tasks import _processar_lembretes_do_tenant

            ConfiguracaoNotificacao.objects.create(ativo=True, waha_session=clinica.schema_name)
            proc = Procedimento.objects.create(nome="Limpeza")
            pac = Paciente.objects.create(nome_completo="Zé", cpf="11122233344", telefone_whatsapp=TEL)
            dent = Dentista.objects.create(nome_completo="Dra", cro="CRO-1")
            # Última limpeza há 7 meses (> 6) e realizada.
            antiga = timezone.now() - timedelta(days=30 * 7)
            Consulta.objects.create(
                paciente=pac,
                dentista=dent,
                inicio=antiga,
                fim=antiga + timedelta(minutes=30),
                status=Consulta.Status.REALIZADA,
                procedimento_catalogo=proc,
            )
            TemplateMensagem.objects.create(
                tipo=TemplateMensagem.Tipo.LEMBRETE,
                lembrete_tipo=TemplateMensagem.LembreteTipo.RECALL,
                corpo="Volte, {{paciente}}!",
                procedimento=proc,
                intervalo_meses=6,
            )
            with (
                patch("apps.notificacoes.tasks.garantir_sessao"),
                patch("apps.notificacoes.tasks.enviar_texto", return_value={"id": "m1"}),
            ):
                assert _processar_lembretes_do_tenant() == 1
                # Dedup: não reenvia (uma vez até voltar).
                assert _processar_lembretes_do_tenant() == 0
            assert LogNotificacao.objects.filter(direcao="ENVIADA").count() == 1
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_aviso_pre_consulta_para_confirmados():
    clinica = _criar_clinica("lemb_aviso", "lembaviso.localhost")
    try:
        with schema_context(clinica.schema_name):
            from apps.notificacoes.tasks import _processar_lembretes_do_tenant

            ConfiguracaoNotificacao.objects.create(ativo=True, waha_session=clinica.schema_name)
            dent = Dentista.objects.create(nome_completo="Dr", cro="CRO-2")
            inicio = timezone.now() + timedelta(hours=1)  # dentro das 2h

            # CONFIRMADO -> deve receber o aviso.
            pac_ok = Paciente.objects.create(
                nome_completo="Ana", cpf="55566677788", telefone_whatsapp=TEL
            )
            consulta_ok = Consulta.objects.create(
                paciente=pac_ok,
                dentista=dent,
                inicio=inicio,
                fim=inicio + timedelta(minutes=30),
                status=Consulta.Status.AGENDADA,
                status_confirmacao=Consulta.StatusConfirmacao.CONFIRMADA,
            )
            # PENDENTE (não confirmado), mesma janela -> NÃO deve receber.
            pac_pend = Paciente.objects.create(
                nome_completo="Beto", cpf="99988877766", telefone_whatsapp="5518988887777"
            )
            Consulta.objects.create(
                paciente=pac_pend,
                dentista=dent,
                inicio=inicio + timedelta(minutes=5),
                fim=inicio + timedelta(minutes=35),
                status=Consulta.Status.AGENDADA,
                status_confirmacao=Consulta.StatusConfirmacao.PENDENTE,
            )
            TemplateMensagem.objects.create(
                tipo=TemplateMensagem.Tipo.LEMBRETE,
                lembrete_tipo=TemplateMensagem.LembreteTipo.PRE_CONSULTA,
                corpo="Sua consulta é às {{hora}}",
                horas_antes=2,
            )
            with (
                patch("apps.notificacoes.tasks.garantir_sessao"),
                patch("apps.notificacoes.tasks.enviar_texto", return_value={"id": "m2"}) as mock_env,
            ):
                # Só o confirmado é avisado (o pendente é ignorado).
                assert _processar_lembretes_do_tenant() == 1
                assert mock_env.call_count == 1
                assert mock_env.call_args[0][1] == TEL  # foi para o número do confirmado
                assert _processar_lembretes_do_tenant() == 0  # dedup

            # Registrou o log só para a consulta do confirmado.
            assert LogNotificacao.objects.filter(
                direcao="ENVIADA", consulta=consulta_ok
            ).exists()
            assert LogNotificacao.objects.filter(direcao="ENVIADA").count() == 1
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
