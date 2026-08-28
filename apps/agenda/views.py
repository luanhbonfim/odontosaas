"""Views (API REST) do app agenda."""

from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.mixins import FiltraPorPacienteMixin
from apps.financeiro.models import LancamentoFinanceiro

from .models import Anamnese, Consulta, Ficha
from .serializers import AnamneseSerializer, ConsultaSerializer, FichaSerializer

_STATUS_EXCLUIVEIS = (Consulta.Status.AGENDADA, Consulta.Status.CANCELADA)


class ConsultaViewSet(FiltraPorPacienteMixin, viewsets.ModelViewSet):
    """CRUD de consultas (opera no schema do tenant). Filtra por `?paciente=`."""

    queryset = Consulta.objects.all()
    serializer_class = ConsultaSerializer

    def destroy(self, request, *args, **kwargs):
        """AGENDADA ou CANCELADA podem ser excluídas; realizadas usam a action 'estornar'.

        Bloqueia se houver lançamento financeiro PAGO vinculado (dado vinculado real —
        o FK é SET_NULL, então sem essa checagem a exclusão órfã silenciosamente um
        recebimento já quitado)."""
        consulta = self.get_object()
        if consulta.status not in _STATUS_EXCLUIVEIS:
            return Response(
                {"detail": "Só é possível excluir uma consulta agendada ou cancelada."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        if consulta.lancamentos.filter(status=LancamentoFinanceiro.Status.PAGO).exists():
            return Response(
                {"detail": "Não é possível excluir: há um lançamento financeiro pago vinculado a esta consulta."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

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

    @action(detail=True, methods=["post"])
    def estornar(self, request, pk=None):
        """Estorna uma consulta REALIZADA lançada por engano: volta para CANCELADA,
        revertendo a baixa de estoque e a conta a receber (via signals)."""
        consulta = self.get_object()
        if consulta.status != Consulta.Status.REALIZADA:
            return Response(
                {"detail": "Só é possível estornar uma consulta realizada."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        consulta.status = Consulta.Status.CANCELADA
        consulta.save(update_fields=["status", "atualizado_em"])
        return Response(self.get_serializer(consulta).data)


class AnamneseViewSet(FiltraPorPacienteMixin, viewsets.ModelViewSet):
    """CRUD de anamneses (paciente e, opcionalmente, consulta). Filtra por `?paciente=`."""

    queryset = Anamnese.objects.all()
    serializer_class = AnamneseSerializer


class FichaViewSet(FiltraPorPacienteMixin, viewsets.ModelViewSet):
    """CRUD de fichas clínicas (odontograma + anotações). Filtra por `?paciente=`."""

    queryset = Ficha.objects.all()
    serializer_class = FichaSerializer
