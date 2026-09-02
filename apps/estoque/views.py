"""Views (API REST) do app estoque."""

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.mixins import ExclusaoProtegidaMixin

from .models import CategoriaInsumo, ConsumoInsumo, Fornecedor, Insumo, MovimentacaoEstoque
from .serializers import (
    CategoriaInsumoSerializer,
    ConsumoInsumoSerializer,
    FornecedorSerializer,
    InsumoSerializer,
    MovimentacaoEstoqueSerializer,
)


class CategoriaInsumoViewSet(viewsets.ModelViewSet):
    """CRUD das categorias de insumo."""

    queryset = CategoriaInsumo.objects.all()
    serializer_class = CategoriaInsumoSerializer


class FornecedorViewSet(viewsets.ModelViewSet):
    """CRUD do catálogo de fornecedores da clínica."""

    queryset = Fornecedor.objects.all()
    serializer_class = FornecedorSerializer


class InsumoViewSet(ExclusaoProtegidaMixin, viewsets.ModelViewSet):
    """CRUD de insumos (expõe o `saldo` calculado a partir das movimentações)."""

    queryset = Insumo.objects.all()
    serializer_class = InsumoSerializer
    mensagem_protegido = "Não é possível excluir: há movimentações ou consumos vinculados a este insumo."

    @action(detail=False, methods=["get"])
    def alertas(self, request):
        """Lista os insumos com estoque no/abaixo do mínimo (alerta de reposição)."""
        insumos = [insumo for insumo in self.get_queryset() if insumo.estoque_baixo()]
        return Response(self.get_serializer(insumos, many=True).data)


class MovimentacaoEstoqueViewSet(viewsets.ModelViewSet):
    """CRUD das movimentações de estoque (entradas/saídas). Filtra por `?insumo=`/`?tipo=`."""

    queryset = MovimentacaoEstoque.objects.all()
    serializer_class = MovimentacaoEstoqueSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        insumo = self.request.query_params.get("insumo")
        if insumo:
            queryset = queryset.filter(insumo_id=insumo)
        tipo = self.request.query_params.get("tipo")
        if tipo:
            queryset = queryset.filter(tipo=tipo)
        return queryset


class ConsumoInsumoViewSet(viewsets.ModelViewSet):
    """CRUD dos insumos consumidos por consulta (base da baixa automática). Filtra por `?consulta=`."""

    queryset = ConsumoInsumo.objects.all()
    serializer_class = ConsumoInsumoSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        consulta = self.request.query_params.get("consulta")
        if consulta:
            queryset = queryset.filter(consulta_id=consulta)
        return queryset
