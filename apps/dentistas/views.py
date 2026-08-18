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
