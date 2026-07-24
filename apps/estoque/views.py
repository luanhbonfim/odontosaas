"""Views (API REST) do app estoque."""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import CategoriaInsumo, ConsumoInsumo, Insumo, MovimentacaoEstoque
from .serializers import (
    CategoriaInsumoSerializer,
    ConsumoInsumoSerializer,
    InsumoSerializer,
    MovimentacaoEstoqueSerializer,
)


class CategoriaInsumoViewSet(viewsets.ModelViewSet):
    """CRUD das categorias de insumo."""

    queryset = CategoriaInsumo.objects.all()
    serializer_class = CategoriaInsumoSerializer


class InsumoViewSet(viewsets.ModelViewSet):
    """CRUD de insumos (expõe o `saldo` calculado a partir das movimentações)."""

    queryset = Insumo.objects.all()
    serializer_class = InsumoSerializer

    @action(detail=False, methods=["get"])
    def alertas(self, request):
        """Lista os insumos com estoque no/abaixo do mínimo (alerta de reposição)."""
        insumos = [insumo for insumo in self.get_queryset() if insumo.estoque_baixo()]
        return Response(self.get_serializer(insumos, many=True).data)


class MovimentacaoEstoqueViewSet(viewsets.ModelViewSet):
    """CRUD das movimentações de estoque (entradas/saídas)."""

    queryset = MovimentacaoEstoque.objects.all()
    serializer_class = MovimentacaoEstoqueSerializer


class ConsumoInsumoViewSet(viewsets.ModelViewSet):
    """CRUD dos insumos consumidos por consulta (base da baixa automática)."""

    queryset = ConsumoInsumo.objects.all()
    serializer_class = ConsumoInsumoSerializer
