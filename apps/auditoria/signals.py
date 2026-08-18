"""Signals de auditoria: registram ações sobre os modelos sensíveis (LGPD)."""

from django.db.models.signals import post_delete, post_save

from .models import RegistroAuditoria
from .services import registrar_auditoria


def _on_save(sender, instance, created, **kwargs):
    acao = RegistroAuditoria.Acao.CRIACAO if created else RegistroAuditoria.Acao.ALTERACAO
    registrar_auditoria(instance, acao)


def _on_delete(sender, instance, **kwargs):
    registrar_auditoria(instance, RegistroAuditoria.Acao.EXCLUSAO)


def conectar():
    """Liga os signals aos modelos com dados pessoais/sensíveis (LGPD) e às
    mutações críticas: gestão de usuários e movimentações financeiras (N18)."""
    from django.contrib.auth import get_user_model

    from apps.agenda.models import Anamnese
    from apps.financeiro.models import Fatura, LancamentoFinanceiro
    from apps.pacientes.models import Guia, Paciente

    modelos = (
        Paciente,
        Anamnese,
        Guia,
        LancamentoFinanceiro,
        Fatura,
        get_user_model(),  # gestão de usuários (criar/bloquear/trocar papel/senha)
    )
    for modelo in modelos:
        nome = modelo.__name__
        post_save.connect(_on_save, sender=modelo, dispatch_uid=f"auditoria_save_{nome}")
        post_delete.connect(_on_delete, sender=modelo, dispatch_uid=f"auditoria_delete_{nome}")
