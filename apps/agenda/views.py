"""Views (API REST) do app agenda."""

from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Anamnese, Consulta
from .serializers import AnamneseSerializer, ConsultaSerializer


class ConsultaViewSet(viewsets.ModelViewSet):
    """CRUD de consultas (opera no schema do tenant da requisição)."""

    queryset = Consulta.objects.all()
    serializer_class = ConsultaSerializer

    def _transicionar(self, request, novo_status, acao):
        consulta = self.get_object()
        if not consulta.pode_transicionar_para(novo_status):
            return Response(
                {"detail": f"Não é possível {acao} (status atual: {consulta.status})."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        consulta.status = novo_status
        consulta.save(update_fields=["status", "atualizado_em"])
        return Response(self.get_serializer(consulta).data)

    @action(detail=True, methods=["post"])
    def iniciar(self, request, pk=None):
        """AGENDADA -> EM_ATENDIMENTO."""
        return self._transicionar(request, Consulta.Status.EM_ATENDIMENTO, "iniciar")

    @action(detail=True, methods=["post"])
    def finalizar(self, request, pk=None):
        """EM_ATENDIMENTO -> REALIZADA."""
        return self._transicionar(request, Consulta.Status.REALIZADA, "finalizar")


class AnamneseViewSet(viewsets.ModelViewSet):
    """CRUD de anamneses (vinculadas a paciente e, opcionalmente, a consulta)."""

    queryset = Anamnese.objects.all()
    serializer_class = AnamneseSerializer
