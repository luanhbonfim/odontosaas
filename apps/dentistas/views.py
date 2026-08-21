"""Views (API REST) do app dentistas."""

from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.response import Response

from .models import Dentista, Especialidade
from .serializers import DentistaSerializer, EspecialidadeSerializer


class EspecialidadeViewSet(viewsets.ModelViewSet):
    """CRUD de especialidades odontológicas (opera no schema do tenant)."""

    queryset = Especialidade.objects.all()
    serializer_class = EspecialidadeSerializer


class DentistaViewSet(viewsets.ModelViewSet):
    """CRUD de dentistas (opera no schema do tenant da requisição).

    O login do profissional NÃO é gerenciado aqui: a conta de acesso (Usuario) é
    criada em Equipe e atrelada a um dentista pelo próprio cadastro de usuário.
    """

    queryset = Dentista.objects.all()
    serializer_class = DentistaSerializer

    def create(self, request, *args, **kwargs):
        """Valida o limite de dentistas ativos do plano antes de criar."""
        tenant = getattr(request, "tenant", None)
        if tenant and hasattr(tenant, "get_limite_dentistas"):
            limite = tenant.get_limite_dentistas()
            if limite is not None:
                total_ativos = Dentista.objects.filter(ativo=True).count()
                if total_ativos >= limite:
                    return Response(
                        {
                            "detail": (
                                f"Limite de dentistas ativos atingido para o plano desta clínica "
                                f"(máximo {limite}). Entre em contato com a administração para realizar upgrade."
                            ),
                            "limite": limite,
                            "atual": total_ativos,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
        return super().create(request, *args, **kwargs)

    def perform_update(self, serializer):
        """Bloqueia reativação se o limite estiver esgotado."""
        tenant = getattr(self.request, "tenant", None)
        if tenant and hasattr(tenant, "get_limite_dentistas"):
            limite = tenant.get_limite_dentistas()
            if limite is not None and serializer.validated_data.get("ativo") is True:
                instancia = serializer.instance
                if not instancia.ativo:
                    total_ativos = Dentista.objects.filter(ativo=True).count()
                    if total_ativos >= limite:
                        from rest_framework.exceptions import ValidationError
                        raise ValidationError(
                            f"Não é possível reativar o profissional: o limite de {limite} dentistas ativos do plano da clínica foi atingido."
                        )
        serializer.save()

    def destroy(self, request, *args, **kwargs):
        """Exclui o dentista; bloqueia (400) se ainda houver pacientes ou consultas vinculados."""
        dentista = self.get_object()
        # Pacientes de que ele é responsável/compartilhado precisam ser reatribuídos antes.
        if dentista.pacientes_responsavel.exists() or dentista.pacientes_compartilhados.exists():
            return Response(
                {
                    "detail": (
                        "Não é possível excluir: há pacientes vinculados a este dentista "
                        "(responsável ou compartilhado). Reatribua-os antes de excluir."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "Não é possível excluir: há registros vinculados (ex.: consultas). "
                        "Inative o dentista pelo cadastro."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
