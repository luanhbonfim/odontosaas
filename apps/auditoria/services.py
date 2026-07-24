"""Serviço de registro de auditoria."""

from .middleware import usuario_atual
from .models import RegistroAuditoria


def registrar_auditoria(instance, acao):
    """Cria um RegistroAuditoria para a ação sobre `instance` (usuário do request)."""
    RegistroAuditoria.objects.create(
        acao=acao,
        modelo=type(instance).__name__,
        objeto_id=str(instance.pk),
        objeto_repr=str(instance)[:255],
        usuario=usuario_atual(),
    )
