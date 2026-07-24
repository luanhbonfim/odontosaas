"""Testes do app notificacoes (models de configuração, template e log)."""

from datetime import timedelta

import pytest
from django.utils import timezone
from django_tenants.utils import schema_context

from apps.agenda.models import Consulta
from apps.core.models import ModeloBase
from apps.dentistas.models import Dentista
from apps.notificacoes.models import (
    ConfiguracaoNotificacao,
    LogNotificacao,
    TemplateMensagem,
)
from apps.pacientes.models import Paciente
from apps.tenants.models import Clinica, Dominio


def _criar_clinica(schema, dominio):
    clinica = Clinica(schema_name=schema, nome_fantasia=schema)
    clinica.save()
    Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
    return clinica


# --- Configuração (sem banco) ---
def test_notificacoes_no_tenant_apps(settings):
    assert "apps.notificacoes" in settings.TENANT_APPS


def test_models_config():
    assert issubclass(ConfiguracaoNotificacao, ModeloBase)
    assert issubclass(TemplateMensagem, ModeloBase)
    assert issubclass(LogNotificacao, ModeloBase)
    tipos = {c[0] for c in TemplateMensagem._meta.get_field("tipo").choices}
    assert tipos == {"CONFIRMACAO", "LEMBRETE", "CANCELAMENTO"}
    status = {c[0] for c in LogNotificacao._meta.get_field("status").choices}
    assert status == {"ENFILEIRADA", "ENVIADA", "ENTREGUE", "LIDA", "RESPONDIDA", "ERRO"}


def test_str():
    assert "antecedência 1d" in str(ConfiguracaoNotificacao())
    assert str(TemplateMensagem(tipo="LEMBRETE")) == "Lembrete"
    assert str(LogNotificacao()) == "Enviada - consulta None (ENFILEIRADA)"


# --- Criação real dentro do schema de um tenant ---
@pytest.mark.django_db(transaction=True)
def test_criar_configuracao_template_e_log():
    clinica = _criar_clinica("notif_tenant", "notif.localhost")
    try:
        with schema_context(clinica.schema_name):
            config = ConfiguracaoNotificacao.objects.create(
                dias_antecedencia=2, waha_session="clinica-notif"
            )
            template = TemplateMensagem.objects.create(
                tipo=TemplateMensagem.Tipo.CONFIRMACAO,
                corpo="Olá {{paciente}}, confirma {{data}} {{hora}}?",
            )
            paciente = Paciente.objects.create(nome_completo="P", cpf="55544433322")
            dentista = Dentista.objects.create(nome_completo="D", cro="CRO-1")
            inicio = timezone.now() + timedelta(days=1)
            consulta = Consulta.objects.create(
                paciente=paciente,
                dentista=dentista,
                inicio=inicio,
                fim=inicio + timedelta(minutes=30),
            )
            log = LogNotificacao.objects.create(
                consulta=consulta,
                template=template,
                mensagem="Olá P, confirma?",
                payload_provedor={"instancia": "x"},
            )

            assert config.horario_envio.hour == 9  # default
            assert log.status == "ENFILEIRADA"
            assert log.canal == "WHATSAPP"
            assert log.payload_provedor["instancia"] == "x"
            assert consulta.notificacoes.count() == 1
    finally:
        from django.db import connection

        connection.set_schema_to_public()
        clinica.delete(force_drop=True)
