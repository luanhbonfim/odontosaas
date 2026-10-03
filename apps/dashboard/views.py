from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import DashboardQuerySerializer, DashboardSerializer
from .services import calcular_dashboard


class DashboardView(APIView):
    """Números do Dashboard (atendimento, financeiro, estoque) por período.

    Qualquer usuário autenticado acessa; os blocos `financeiro`/`estoque` vêm
    `null` quando o usuário não tem permissão de ver o módulo ou o plano da
    clínica o desabilitou — a view não passa pelo gate de path do `PermissaoModulo`.
    """

    @extend_schema(
        parameters=[
            OpenApiParameter("periodo", str, enum=["mes", "semestre", "ano"], required=False)
        ],
        responses=DashboardSerializer,
    )
    def get(self, request):
        consulta = DashboardQuerySerializer(data=request.query_params)
        consulta.is_valid(raise_exception=True)
        dados = calcular_dashboard(
            request.user,
            consulta.validated_data["periodo"],
            tenant=getattr(request, "tenant", None),
        )
        return Response(DashboardSerializer(dados).data)
