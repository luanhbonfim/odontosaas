"""Views (API REST) do app auditoria — consulta somente-leitura da trilha."""

from datetime import datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets

from apps.core.pagination import PaginacaoPadrao

from .models import RegistroAuditoria
from .serializers import RegistroAuditoriaSerializer


def _dia_local(valor):
    """`AAAA-MM-DD` -> date (None se vazio/inválido: o filtro é ignorado)."""
    try:
        return datetime.strptime(valor, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return None


class RegistroAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta da trilha de auditoria (somente leitura, paginada).

    Filtros opcionais por query string: `?modelo=Paciente`, `?acao=CRIACAO`,
    `?usuario=<id>`, `?de=AAAA-MM-DD` e `?ate=AAAA-MM-DD` (dias inclusivos, no
    fuso da clínica) e `?search=` (descrição do objeto, nome ou e-mail de quem agiu).
    """

    queryset = RegistroAuditoria.objects.select_related("usuario")
    serializer_class = RegistroAuditoriaSerializer
    pagination_class = PaginacaoPadrao

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if modelo := params.get("modelo"):
            qs = qs.filter(modelo=modelo)
        if acao := params.get("acao"):
            qs = qs.filter(acao=acao)
        if usuario := params.get("usuario"):
            qs = qs.filter(usuario_id=usuario) if usuario.isdigit() else qs.none()
        if de := _dia_local(params.get("de")):
            inicio = timezone.make_aware(datetime.combine(de, time.min))
            qs = qs.filter(criado_em__gte=inicio)
        if ate := _dia_local(params.get("ate")):
            fim = timezone.make_aware(datetime.combine(ate + timedelta(days=1), time.min))
            qs = qs.filter(criado_em__lt=fim)
        if termo := params.get("search", "").strip():
            qs = qs.filter(
                Q(objeto_repr__icontains=termo)
                | Q(usuario__nome_completo__icontains=termo)
                | Q(usuario__email__icontains=termo)
            )
        return qs
