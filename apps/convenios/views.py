"""Views (API REST) do app convênios."""

from django.db.models import Count
from rest_framework import viewsets

from apps.core.mixins import ExclusaoProtegidaMixin

from .models import Convenio
from .serializers import ConvenioSerializer


class ConvenioViewSet(ExclusaoProtegidaMixin, viewsets.ModelViewSet):
    """CRUD do catálogo de convênios da clínica (opera no schema do tenant)."""

    # Anota o total de pacientes distintos vinculados (via planos) para a listagem.
    queryset = Convenio.objects.annotate(
        pacientes_count=Count("planos__paciente", distinct=True)
    )
    serializer_class = ConvenioSerializer
    mensagem_protegido = (
        "Não é possível excluir: há planos de pacientes vinculados a este convênio."
    )
