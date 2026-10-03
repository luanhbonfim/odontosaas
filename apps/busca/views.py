from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import BuscaQuerySerializer, BuscaSerializer
from .services import buscar


class BuscaView(APIView):
    """Busca global por paciente (nome/CPF) e consulta (paciente/procedimento).

    Qualquer usuário autenticado acessa; cada bloco vem `null` sem a permissão de
    ver o módulo (a view não passa pelo gate de path do `PermissaoModulo`).
    """

    @extend_schema(
        parameters=[OpenApiParameter("q", str, required=False)],
        responses=BuscaSerializer,
    )
    def get(self, request):
        consulta = BuscaQuerySerializer(data=request.query_params)
        consulta.is_valid(raise_exception=True)
        return Response(BuscaSerializer(buscar(request.user, consulta.validated_data["q"])).data)
