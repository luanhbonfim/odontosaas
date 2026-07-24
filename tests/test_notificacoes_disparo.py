"""Testes da task de disparo de pedidos de confirmação (Beat)."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context
from requests import RequestException

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.notificacoes.models import (
    ConfiguracaoNotificacao,
    LogNotificacao,
    TemplateMensagem,
)
from apps.notificacoes.tasks import disparar_lembretes_todos_tenants
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _preparar_consulta(dias=1):
    """Config + template + consulta na janela de antecedência. Requer schema ativo."""
    ConfiguracaoNotificacao.objects.create(
        dias_antecedencia=dias, waha_session="clinica-x", ativo=True
    )
    TemplateMensagem.objects.create(
        tipo=TemplateMensagem.Tipo.CONFIRMACAO,
        corpo="Olá {{paciente}}, confirma {{data}} {{hora}} com {{dentista}}?",
        ativo=True,
    )
    paciente = Paciente.objects.create(
        nome_completo="Ana", cpf="55511122233", telefone_whatsapp="5511999998888"
    )
    dentista = Dentista.objects.create(nome_completo="Dr. X", cro="CRO-1")
    inicio = timezone.localtime().replace(hour=12, minute=0, second=0, microsecond=0) + timedelta(
        days=dias
    )
    return Consulta.objects.create(
        paciente=paciente, dentista=dentista, inicio=inicio, fim=inicio + timedelta(minutes=30)
    )


def test_beat_schedule_disparo_registrado(settings):
    assert "disparar-lembretes-whatsapp" in settings.CELERY_BEAT_SCHEDULE


@pytest.mark.django_db(transaction=True)
def test_dispara_lembrete_e_nao_duplica():
    clinica = _criar_clinica("disparo_tenant", "disparo.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _preparar_consulta()
            cid = consulta.id

        with (
            patch("apps.notificacoes.tasks.enviar_texto", return_value={"id": "m1"}) as mock_send,
            patch("apps.notificacoes.tasks.garantir_sessao", return_value=True) as mock_sess,
        ):
            total = disparar_lembretes_todos_tenants()
            assert total == 1
            mock_sess.assert_called_once()
            mensagem = mock_send.call_args.args[2]
            assert "Ana" in mensagem and "Dr. X" in mensagem

        with schema_context(clinica.schema_name):
            log = LogNotificacao.objects.get(consulta_id=cid)
            assert log.status == "ENVIADA"
            assert log.enviado_em is not None

        # 2ª execução não reenvia (dedup por log ENVIADA)
        with (
            patch("apps.notificacoes.tasks.enviar_texto", return_value={"id": "m2"}) as mock_send2,
            patch("apps.notificacoes.tasks.garantir_sessao", return_value=True),
        ):
            assert disparar_lembretes_todos_tenants() == 0
            mock_send2.assert_not_called()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_erro_no_envio_gera_log_erro():
    clinica = _criar_clinica("disparo_erro_tenant", "disparoerro.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _preparar_consulta()
            cid = consulta.id

        with (
            patch(
                "apps.notificacoes.tasks.enviar_texto",
                side_effect=RequestException("falha WAHA"),
            ),
            patch("apps.notificacoes.tasks.garantir_sessao", return_value=True),
        ):
            assert disparar_lembretes_todos_tenants() == 0

        with schema_context(clinica.schema_name):
            log = LogNotificacao.objects.get(consulta_id=cid)
            assert log.status == "ERRO"
            assert "falha WAHA" in log.payload_provedor["erro"]
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_sem_config_nao_dispara():
    clinica = _criar_clinica("disparo_semcfg_tenant", "disparosemcfg.localhost")
    try:
        # Sem ConfiguracaoNotificacao -> nada é disparado
        with (
            patch("apps.notificacoes.tasks.enviar_texto") as mock_send,
            patch("apps.notificacoes.tasks.garantir_sessao"),
        ):
            assert disparar_lembretes_todos_tenants() == 0
            mock_send.assert_not_called()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
