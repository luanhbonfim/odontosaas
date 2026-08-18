"""Testes do fluxo de reagendamento, da fila e das travas template↔permissão."""

from datetime import time, timedelta
from unittest.mock import patch

import pytest
from django.db import connection
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.agenda.models import Consulta
from apps.dentistas.models import Dentista
from apps.notificacoes.defaults import semear_templates_padrao
from apps.notificacoes.models import (
    ConfiguracaoNotificacao,
    TemplateMensagem,
)
from apps.notificacoes.serializers import (
    ConfiguracaoNotificacaoSerializer,
    TemplateMensagemSerializer,
)
from apps.notificacoes.tasks import (
    _processar_reagendamentos_do_tenant,
    fila_pendente,
)
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


def _base():
    """Config + templates padrão + uma consulta futura confirmada. Schema ativo."""
    ConfiguracaoNotificacao.objects.create(
        dias_antecedencia=1,
        horario_envio=time(0, 0),
        reagendamento_minutos=0,  # sem atraso p/ o teste (evita esperar 1 min)
        waha_session="clinica-x",
        ativo=True,
    )
    semear_templates_padrao()  # cria CONFIRMACAO/CANCELAMENTO/AGRADECIMENTO/REAGENDAMENTO ativos
    paciente = Paciente.objects.create(
        nome_completo="Ana", cpf="55511122233", telefone_whatsapp="5511999998888"
    )
    dentista = Dentista.objects.create(nome_completo="Dr. X", cro="CRO-1")
    inicio = timezone.now() + timedelta(days=2)
    return Consulta.objects.create(
        paciente=paciente,
        dentista=dentista,
        inicio=inicio,
        fim=inicio + timedelta(minutes=30),
        status=Consulta.Status.AGENDADA,
        status_confirmacao=Consulta.StatusConfirmacao.CONFIRMADA,
    )


@pytest.mark.django_db(transaction=True)
def test_reagendamento_marca_e_dispara_uma_vez():
    clinica = _criar_clinica("reag_tenant", "reag.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _base()
            assert consulta.reagendada_em is None
            # Reagenda: muda o início de uma consulta já existente e ativa.
            consulta.inicio = consulta.inicio + timedelta(hours=3)
            consulta.fim = consulta.inicio + timedelta(minutes=30)
            consulta.save()
            consulta.refresh_from_db()
            assert consulta.reagendada_em is not None

            with (
                patch("apps.notificacoes.tasks.enviar_texto", return_value={"id": "m1"}),
                patch("apps.notificacoes.tasks.garantir_sessao", return_value=True),
            ):
                assert _processar_reagendamentos_do_tenant() == 1
                # 2ª rodada não reenvia (dedup por 'versão' do reagendamento).
                assert _processar_reagendamentos_do_tenant() == 0
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_reagendamento_desligado_nao_dispara():
    clinica = _criar_clinica("reag_off_tenant", "reagoff.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _base()
            ConfiguracaoNotificacao.objects.update(enviar_reagendamento=False)
            consulta.inicio = consulta.inicio + timedelta(hours=3)
            consulta.save()
            with (
                patch("apps.notificacoes.tasks.enviar_texto") as mock_send,
                patch("apps.notificacoes.tasks.garantir_sessao"),
            ):
                assert _processar_reagendamentos_do_tenant() == 0
                mock_send.assert_not_called()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_fila_inclui_reagendamento_e_confirmacao():
    clinica = _criar_clinica("fila_tenant", "fila.localhost")
    try:
        with schema_context(clinica.schema_name):
            consulta = _base()
            # Pendente -> entra como CONFIRMACAO na fila.
            consulta.status_confirmacao = Consulta.StatusConfirmacao.PENDENTE
            consulta.save(update_fields=["status_confirmacao"])
            tipos = {i["tipo"] for i in fila_pendente()}
            assert TemplateMensagem.Tipo.CONFIRMACAO in tipos

            # Confirma e reagenda -> some a confirmação, entra o reagendamento.
            consulta.status_confirmacao = Consulta.StatusConfirmacao.CONFIRMADA
            consulta.inicio = consulta.inicio + timedelta(hours=2)
            consulta.save()
            tipos = {i["tipo"] for i in fila_pendente()}
            assert TemplateMensagem.Tipo.REAGENDAMENTO in tipos
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_trava_config_liga_cancelamento_com_template_inativo():
    clinica = _criar_clinica("trava_cfg_tenant", "travacfg.localhost")
    try:
        with schema_context(clinica.schema_name):
            config = ConfiguracaoNotificacao.objects.create(
                waha_session="s", ativo=True, enviar_cancelamento=False
            )
            semear_templates_padrao()
            TemplateMensagem.objects.filter(
                tipo=TemplateMensagem.Tipo.CANCELAMENTO
            ).update(ativo=False)

            serializer = ConfiguracaoNotificacaoSerializer(
                config, data={"enviar_cancelamento": True}, partial=True
            )
            assert not serializer.is_valid()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)


@pytest.mark.django_db(transaction=True)
def test_trava_inativar_confirmacao_com_notificacoes_ativas():
    clinica = _criar_clinica("trava_tpl_tenant", "travatpl.localhost")
    try:
        with schema_context(clinica.schema_name):
            ConfiguracaoNotificacao.objects.create(waha_session="s", ativo=True)
            semear_templates_padrao()
            confirmacao = TemplateMensagem.objects.get(
                tipo=TemplateMensagem.Tipo.CONFIRMACAO
            )
            serializer = TemplateMensagemSerializer(
                confirmacao, data={"ativo": False}, partial=True
            )
            assert not serializer.is_valid()
    finally:
        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
