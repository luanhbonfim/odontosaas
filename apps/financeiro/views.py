"""Views (API REST) do app financeiro."""

from django.utils import timezone
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Fatura, LancamentoFinanceiro
from .serializers import (
    FaturaSerializer,
    FluxoCaixaSerializer,
    LancamentoFinanceiroSerializer,
)
from .services import calcular_fluxo_caixa, faturar_operadora


class LancamentoFinanceiroViewSet(viewsets.ModelViewSet):
    """
    CRUD de lançamentos financeiros (contas a pagar/receber) + ajustes manuais.

    Filtros opcionais por query string: `?tipo=RECEITA|DESPESA` e `?status=...`.
    """

    queryset = LancamentoFinanceiro.objects.all()
    serializer_class = LancamentoFinanceiroSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        tipo = self.request.query_params.get("tipo")
        status_param = self.request.query_params.get("status")
        if tipo:
            qs = qs.filter(tipo=tipo)
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=["post"])
    def quitar(self, request, pk=None):
        """Baixa manual: marca o lançamento como PAGO/RECEBIDO com a data atual."""
        lancamento = self.get_object()
        lancamento.status = LancamentoFinanceiro.Status.PAGO
        lancamento.pago_em = timezone.now()
        lancamento.save(update_fields=["status", "pago_em", "atualizado_em"])
        return Response(self.get_serializer(lancamento).data)

    @action(detail=False, methods=["get"], url_path="fluxo-caixa")
    def fluxo_caixa(self, request):
        """Relatório de fluxo de caixa (a receber × a pagar). Filtro opcional: ?de=&ate=."""
        dados = calcular_fluxo_caixa(
            request.query_params.get("de"), request.query_params.get("ate")
        )
        return Response(FluxoCaixaSerializer(dados).data)


class FaturaViewSet(viewsets.ModelViewSet):
    """CRUD de faturas + faturamento por operadora (agrupa contas a receber)."""

    queryset = Fatura.objects.all()
    serializer_class = FaturaSerializer

    @action(detail=False, methods=["post"])
    def faturar(self, request):
        """Gera uma fatura agrupando as contas a receber pendentes de uma operadora."""
        operadora = request.data.get("operadora")
        if not operadora:
            return Response({"operadora": "Obrigatório."}, status=http_status.HTTP_400_BAD_REQUEST)
        fatura = faturar_operadora(operadora, request.data.get("competencia", ""))
        if fatura is None:
            return Response(
                {"detail": "Nenhuma conta a receber pendente para essa operadora."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        return Response(self.get_serializer(fatura).data, status=http_status.HTTP_201_CREATED)
