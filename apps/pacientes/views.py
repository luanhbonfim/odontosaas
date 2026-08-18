"""Views (API REST) do app pacientes."""

from rest_framework import filters, viewsets

from apps.core.mixins import ExclusaoProtegidaMixin, FiltraPorPacienteMixin, escopo_dentista_q
from apps.core.pagination import PaginacaoPadrao

from .models import Guia, Paciente, PlanoOdontologico
from .serializers import GuiaSerializer, PacienteSerializer, PlanoOdontologicoSerializer


class PacienteViewSet(viewsets.ModelViewSet):
    """CRUD de pacientes (opera no schema do tenant da requisição).

    Lista **paginada** (`?page`) com **busca** (`?search=` por nome/CPF) e
    ordenação (`?ordering=`). Base do padrão para listas grandes.

    **Escopo row-level:** o DENTISTA vê só os pacientes onde é o responsável **ou**
    tem consulta; Gerente/Recepção/Admin veem todos.
    """

    queryset = Paciente.objects.all()
    serializer_class = PacienteSerializer
    pagination_class = PaginacaoPadrao
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nome_completo", "cpf"]
    ordering_fields = [
        "nome_completo",
        "cpf",
        "ativo",
        "criado_em",
        "dentista_responsavel__nome_completo",
    ]
    ordering = ["nome_completo"]

    def get_queryset(self):
        queryset = super().get_queryset()
        usuario = self.request.user
        if getattr(usuario, "papel", None) == "DENTISTA":
            # Fail-closed: dentista sem cadastro vinculado não vê nenhum paciente.
            dentista = getattr(usuario, "dentista", None)
            if dentista is None:
                return queryset.none()
            queryset = queryset.filter(escopo_dentista_q(dentista)).distinct()

        # Filtros opcionais (querystring): status e dentista responsável.
        params = self.request.query_params
        ativo = params.get("ativo")
        if ativo in ("true", "false"):
            queryset = queryset.filter(ativo=(ativo == "true"))
        responsavel = params.get("dentista_responsavel")
        if responsavel == "nenhum":
            queryset = queryset.filter(dentista_responsavel__isnull=True)
        elif responsavel:
            queryset = queryset.filter(dentista_responsavel_id=responsavel)
        return queryset

    def perform_create(self, serializer):
        # Dentista que cadastra vira o responsável (mantém acesso; não reatribui).
        usuario = self.request.user
        dentista = getattr(usuario, "dentista", None)
        if getattr(usuario, "papel", None) == "DENTISTA" and dentista is not None:
            serializer.save(dentista_responsavel=dentista)
        else:
            serializer.save()


class PlanoOdontologicoViewSet(
    ExclusaoProtegidaMixin, FiltraPorPacienteMixin, viewsets.ModelViewSet
):
    """CRUD dos planos odontológicos dos pacientes. Filtra por `?paciente=`."""

    queryset = PlanoOdontologico.objects.all()
    serializer_class = PlanoOdontologicoSerializer
    mensagem_protegido = "Não é possível excluir: há guias vinculadas a este plano. Cancele o plano em vez de excluir."


class GuiaViewSet(FiltraPorPacienteMixin, viewsets.ModelViewSet):
    """CRUD das guias de procedimento. Filtra por `?paciente=` (via plano)."""

    queryset = Guia.objects.all()
    serializer_class = GuiaSerializer
    campo_paciente = "plano__paciente"
