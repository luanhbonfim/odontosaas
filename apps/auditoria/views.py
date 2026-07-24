"""Views (API REST) do app auditoria — consulta somente-leitura da trilha."""

from rest_framework import viewsets

from .models import RegistroAuditoria
from .serializers import RegistroAuditoriaSerializer


class RegistroAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Consulta da trilha de auditoria (somente leitura).

    Filtros opcionais por query string: `?modelo=Paciente` e `?acao=CRIACAO`.
    """

    queryset = RegistroAuditoria.objects.all()
    serializer_class = RegistroAuditoriaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        modelo = self.request.query_params.get("modelo")
        acao = self.request.query_params.get("acao")
        if modelo:
            qs = qs.filter(modelo=modelo)
        if acao:
            qs = qs.filter(acao=acao)
        return qs
