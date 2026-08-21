"""
ViewSet do Database Studio para exploração e execução SQL segura.
"""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.throttling import StudioThrottle
from apps.plataforma_admin.permissions import IsVendorStaff
from apps.plataforma_admin.serializers import StudioExecuteInputSerializer
from apps.plataforma_admin.studio import (
    executar_sql_studio,
    explorar_schemas,
    explorar_tabelas,
)


class StudioViewSet(viewsets.ViewSet):
    """
    Database Studio do SaaS: exploração de schemas/tabelas e console SQL seguro.
    Acesso restrito a operadores do vendor no host público.
    """

    permission_classes = [IsVendorStaff]
    throttle_classes = [StudioThrottle]

    @action(detail=False, methods=["get"], url_path="schemas")
    def schemas(self, request):
        """Lista todos os schemas com contagem de tabelas."""
        try:
            dados = explorar_schemas()
            return Response({"schemas": dados})
        except Exception as exc:
            return Response(
                {"erro": "Falha ao listar schemas.", "detalhes": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"], url_path="tables")
    def tables(self, request):
        """Retorna o dicionário de dados (tabelas e colunas) do schema informado."""
        schema_name = request.query_params.get("schema", "public").strip()
        try:
            dados = explorar_tabelas(schema_name)
            return Response({"schema": schema_name, "tabelas": dados})
        except Exception as exc:
            return Response(
                {"erro": "Falha ao explorar tabelas do schema.", "detalhes": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"], url_path="executar")
    def executar(self, request):
        """Executa query SQL no Database Studio."""
        serializer = StudioExecuteInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dados = serializer.validated_data

        modo = dados["modo"]
        schema_name = dados["schema"]
        sql = dados["sql"]
        justificativa = dados.get("justificativa", "")
        limite_linhas = dados.get("limite_linhas", 100)

        # Validação de privilégio para modo RW
        if modo == "RW" and not request.user.is_superuser:
            return Response(
                {
                    "erro": "Permissão negada.",
                    "mensagem": "O modo de escrita/DML (RW) é restrito a superadministradores da plataforma.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        operador_email = getattr(request.user, "email", str(request.user))

        try:
            resultado = executar_sql_studio(
                schema_name=schema_name,
                sql=sql,
                modo=modo,
                operador_email=operador_email,
                justificativa=justificativa,
                request=request,
                limite_linhas=limite_linhas,
            )
            return Response(resultado, status=status.HTTP_200_OK)
        except PermissionError as exc:
            return Response(
                {"erro": "Operação proibida.", "mensagem": str(exc)},
                status=status.HTTP_403_FORBIDDEN,
            )
        except Exception as exc:
            return Response(
                {"erro": "Erro na execução SQL.", "detalhes": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
