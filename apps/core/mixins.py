"""Mixins reutilizáveis de API."""

from django.db.models import ProtectedError, Q
from rest_framework import status
from rest_framework.response import Response


def escopo_dentista_q(dentista, prefixo=""):
    """Q para registros cujo PACIENTE está no escopo do dentista: é **responsável**,
    está **compartilhado**, OU tem **consulta** com ele.

    `prefixo` é o caminho até o Paciente a partir do model consultado:
    `""` (Paciente), `"paciente__"` (Consulta/Anamnese/Plano) ou
    `"plano__paciente__"` (Guia).
    """
    return (
        Q(**{f"{prefixo}dentista_responsavel": dentista})
        | Q(**{f"{prefixo}dentistas_compartilhados": dentista})
        | Q(**{f"{prefixo}consultas__dentista": dentista})
    )


class ExclusaoProtegidaMixin:
    """`destroy()` devolve 400 amigável quando há registros vinculados (FK PROTECT),
    em vez de estourar 500. Mensagem configurável por `mensagem_protegido`."""

    mensagem_protegido = "Não é possível excluir: há registros vinculados."

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({"detail": self.mensagem_protegido}, status=status.HTTP_400_BAD_REQUEST)


class FiltraPorPacienteMixin:
    """Filtra por `?paciente=<id>` **e** aplica o escopo row-level do dentista.

    Usado pela Ficha do Paciente (planos, guias, consultas, anamneses). O caminho
    até o FK de paciente é configurável via `campo_paciente` (ex.: as Guias
    referenciam o paciente por `plano__paciente`).

    **Escopo:** um DENTISTA só enxerga registros de pacientes no seu escopo
    (responsável/compartilhado/com consulta) — mesma regra do `PacienteViewSet`,
    para não vazar dados de pacientes de outros dentistas. Fail-closed: dentista
    sem cadastro vinculado não vê nada.
    """

    campo_paciente = "paciente"

    def get_queryset(self):
        queryset = super().get_queryset()
        usuario = self.request.user
        if getattr(usuario, "papel", None) == "DENTISTA":
            dentista = getattr(usuario, "dentista", None)
            if dentista is None:
                return queryset.none()
            prefixo = f"{self.campo_paciente}__"
            queryset = queryset.filter(escopo_dentista_q(dentista, prefixo)).distinct()
        paciente = self.request.query_params.get("paciente")
        if paciente:
            queryset = queryset.filter(**{f"{self.campo_paciente}_id": paciente})
        return queryset
