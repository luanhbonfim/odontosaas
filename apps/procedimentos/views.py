"""Views (API REST) do app procedimentos."""

from rest_framework import viewsets

from apps.core.mixins import ExclusaoProtegidaMixin

from .models import Procedimento
from .serializers import ProcedimentoSerializer


class ProcedimentoViewSet(ExclusaoProtegidaMixin, viewsets.ModelViewSet):
    """CRUD do catálogo de procedimentos da clínica (opera no schema do tenant)."""

    queryset = Procedimento.objects.all()
    serializer_class = ProcedimentoSerializer
    mensagem_protegido = "Não é possível excluir: há consultas vinculadas a este procedimento."
