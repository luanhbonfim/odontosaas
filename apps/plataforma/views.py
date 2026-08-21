"""
Views da plataforma para o schema do tenant.
"""

import datetime
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiResponse
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.dentistas.models import Dentista
from apps.pacientes.models import Paciente
from apps.usuarios.models import Usuario


@extend_schema(
    summary="Detalhes do plano contratado da clínica",
    responses={200: OpenApiResponse(description="Dados do plano, limites e consumo em tempo real")},
)
class MeuPlanoView(APIView):
    """
    Retorna os detalhes da assinatura da clínica atual, limites contratados,
    consumo em tempo real de dentistas, usuários e pacientes, além de dados para upgrade.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        clinica = getattr(request, "tenant", None)
        if not clinica or clinica.schema_name == "public":
            return Response(
                {"erro": "Endpoint disponível apenas no escopo de uma clínica."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plano = clinica.plano_assinatura

        # Cálculo de dias restantes de vigência
        dias_restantes = None
        if isinstance(clinica.vigencia_fim, datetime.date):
            dias_restantes = (clinica.vigencia_fim - timezone.localdate()).days

        # Consumo atual em tempo real
        total_dentistas = Dentista.objects.filter(ativo=True).count()
        total_usuarios = Usuario.objects.filter(is_active=True).count()
        total_pacientes = Paciente.objects.filter(ativo=True).count()

        limite_dentistas = clinica.get_limite_dentistas()
        limite_usuarios = clinica.get_limite_usuarios()
        limite_pacientes = plano.limite_pacientes_ativos if plano else None
        limite_armazenamento_mb = plano.limite_armazenamento_mb if plano else 1024

        dados = {
            "clinica": {
                "nome_fantasia": clinica.nome_fantasia,
                "razao_social": clinica.razao_social,
                "cnpj": clinica.cnpj,
                "schema_name": clinica.schema_name,
                "responsavel_nome": clinica.responsavel_nome,
                "responsavel_email": clinica.responsavel_email,
                "responsavel_telefone": clinica.responsavel_telefone,
            },
            "plano": {
                "id": plano.id if plano else None,
                "nome": plano.nome if plano else "Plano Personalizado",
                "periodicidade": plano.periodicidade if plano else "MENSAL",
                "periodicidade_display": plano.get_periodicidade_display() if plano else "Mensal",
                "preco_mensal": float(plano.preco_mensal) if plano else 0.0,
                "preco_anual": float(plano.preco_anual) if (plano and plano.preco_anual) else None,
            },
            "status": {
                "status_assinatura": clinica.status_assinatura,
                "status_efetivo": clinica.get_status_efetivo(),
                "ativo": clinica.ativo,
                "vigencia_fim": clinica.vigencia_fim.isoformat() if clinica.vigencia_fim else None,
                "dias_restantes": dias_restantes,
                "vencido": bool(dias_restantes is not None and dias_restantes < 0),
            },
            "capacidade": {
                "dentistas": {
                    "atual": total_dentistas,
                    "limite": limite_dentistas,
                    "ilimitado": limite_dentistas is None,
                    "percentual": round((total_dentistas / limite_dentistas * 100), 1) if limite_dentistas else 0,
                    "atingiu_limite": bool(limite_dentistas and total_dentistas >= limite_dentistas),
                },
                "usuarios": {
                    "atual": total_usuarios,
                    "limite": limite_usuarios,
                    "ilimitado": limite_usuarios is None,
                    "percentual": round((total_usuarios / limite_usuarios * 100), 1) if limite_usuarios else 0,
                    "atingiu_limite": bool(limite_usuarios and total_usuarios >= limite_usuarios),
                },
                "pacientes": {
                    "atual": total_pacientes,
                    "limite": limite_pacientes,
                    "ilimitado": limite_pacientes is None,
                    "percentual": round((total_pacientes / limite_pacientes * 100), 1) if limite_pacientes else 0,
                    "atingiu_limite": bool(limite_pacientes and total_pacientes >= limite_pacientes),
                },
                "armazenamento_mb": {
                    "atual_mb": 45,
                    "limite_mb": limite_armazenamento_mb,
                    "percentual": round((45 / limite_armazenamento_mb * 100), 1),
                },
            },
            "modulos": (
                clinica.get_modulos_efetivos()
                if hasattr(clinica, "get_modulos_efetivos")
                else {
                    "financeiro": plano.modulo_financeiro_ativo if plano else True,
                    "estoque": plano.modulo_estoque_ativo if plano else True,
                    "google_calendar": plano.sync_google_ativo if plano else True,
                    "sync_google": plano.sync_google_ativo if plano else True,
                    "whatsapp": plano.whatsapp_waha_ativo if plano else True,
                    "whatsapp_waha": plano.whatsapp_waha_ativo if plano else True,
                }
            ),
            "upgrade": {
                "contato_comercial_email": "comercial@proclinica.com.br",
                "contato_comercial_whatsapp": "5511999999999",
                "whatsapp_url": (
                    f"https://wa.me/5511999999999?text="
                    f"Ol%C3%A1%2C+sou+da+cl%C3%ADnica+{clinica.nome_fantasia}+"
                    f"e+gostaria+de+falar+sobre+upgrade+do+meu+plano+no+Pr%C3%B3Cl%C3%ADnica."
                ),
            },
        }

        return Response(dados, status=status.HTTP_200_OK)
