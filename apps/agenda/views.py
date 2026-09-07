"""Views (API REST) do app agenda."""

from django.db.models import Exists, OuterRef
from django.utils import timezone
from rest_framework import status as http_status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.mixins import FiltraPorPacienteMixin
from apps.financeiro.models import LancamentoFinanceiro
from apps.pacientes.models import Guia
from apps.usuarios.models import Usuario

from .models import Anamnese, Consulta, Ficha
from .serializers import AnamneseSerializer, ConsultaSerializer, FichaSerializer

_STATUS_EXCLUIVEIS = (Consulta.Status.AGENDADA, Consulta.Status.CANCELADA)


class ConsultaViewSet(FiltraPorPacienteMixin, viewsets.ModelViewSet):
    """CRUD de consultas (opera no schema do tenant). Filtra por `?paciente=`."""

    queryset = Consulta.objects.all()
    serializer_class = ConsultaSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Anota se já tem lançamento/guia vinculado (pro badge "sem pagamento" da
        # agenda no front, sem N+1 — mesmo padrão de PacienteViewSet.get_queryset).
        return queryset.annotate(
            _tem_lancamento=Exists(LancamentoFinanceiro.objects.filter(consulta=OuterRef("pk"))),
            _tem_guia=Exists(Guia.objects.filter(consulta=OuterRef("pk"))),
        )

    def _recalcular_vinculos(self, consulta):
        """Recalcula `_tem_lancamento`/`_tem_guia` na própria instância depois de
        um save — a anotação do `get_queryset` foi computada ANTES desse save, e
        fica desatualizada quando o próprio save (via signal) gera o lançamento
        nesta mesma requisição (ex.: PATCH define forma_pagamento -> gera a conta
        -> a resposta precisa refletir isso, não o estado de antes do save)."""
        consulta._tem_lancamento = consulta.lancamentos.exists()
        consulta._tem_guia = consulta.guias.exists()

    def perform_update(self, serializer):
        instance = serializer.save()
        self._recalcular_vinculos(instance)

    def destroy(self, request, *args, **kwargs):
        """AGENDADA ou CANCELADA podem ser excluídas por qualquer papel com acesso
        (bloqueia se houver lançamento financeiro PAGO vinculado — o FK é SET_NULL,
        então sem essa checagem a exclusão órfã silenciosamente um recebimento já
        quitado); realizadas usam a action 'estornar' antes.

        ADMIN é a exceção: exclui qualquer consulta, em qualquer status (inclusive
        Realizada e com pagamento já quitado) — e cascateia de verdade tudo que só
        existe por causa dela (lançamentos financeiros, baixas de estoque), que por
        padrão (SET_NULL) só ficariam órfãos numa exclusão normal. A guia do
        convênio (se houver) só é desvinculada, não apagada — ela é um documento de
        cobrança com vida própria, não algo "da" consulta."""
        consulta = self.get_object()
        eh_admin = getattr(request.user, "papel", None) == Usuario.Papel.ADMIN
        if not eh_admin:
            if consulta.status not in _STATUS_EXCLUIVEIS:
                return Response(
                    {"detail": "Só é possível excluir uma consulta agendada ou cancelada."},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            if consulta.lancamentos.filter(status=LancamentoFinanceiro.Status.PAGO).exists():
                return Response(
                    {"detail": "Não é possível excluir: há um lançamento financeiro pago vinculado a esta consulta."},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
        else:
            consulta.lancamentos.all().delete()
            consulta.movimentacoes_estoque.all().delete()
        return super().destroy(request, *args, **kwargs)

    def _transicionar(self, request, novo_status, acao):
        consulta = self.get_object()
        if not consulta.pode_transicionar_para(novo_status):
            return Response(
                {"detail": f"Não é possível {acao} (status atual: {consulta.status})."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        consulta.status = novo_status
        consulta.save(update_fields=["status", "atualizado_em"])
        self._recalcular_vinculos(consulta)
        return Response(self.get_serializer(consulta).data)

    @action(detail=True, methods=["post"])
    def iniciar(self, request, pk=None):
        """AGENDADA -> EM_ATENDIMENTO."""
        return self._transicionar(request, Consulta.Status.EM_ATENDIMENTO, "iniciar")

    @action(detail=True, methods=["post"])
    def finalizar(self, request, pk=None):
        """EM_ATENDIMENTO -> REALIZADA."""
        return self._transicionar(request, Consulta.Status.REALIZADA, "finalizar")

    @action(detail=True, methods=["post"])
    def confirmar_manualmente(self, request, pk=None):
        """Confirmação manual (ex.: recepção ligou e confirmou por telefone) —
        fica com status_confirmacao=MANUAL, distinto de CONFIRMADA (via WhatsApp/
        link), mas contando como confirmado pras mesmas regras (reagendamento,
        lembretes, cor no Google)."""
        consulta = self.get_object()
        if consulta.status_confirmacao in Consulta.STATUS_CONFIRMACAO_CONFIRMADOS:
            return Response(
                {"detail": "Esta consulta já está confirmada."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        consulta.status_confirmacao = Consulta.StatusConfirmacao.MANUAL
        consulta.confirmado_em = timezone.now()
        consulta.save(update_fields=["status_confirmacao", "confirmado_em", "atualizado_em"])
        return Response(self.get_serializer(consulta).data)

    @action(detail=True, methods=["post"])
    def estornar(self, request, pk=None):
        """Estorna uma consulta REALIZADA lançada por engano: volta para CANCELADA,
        revertendo a baixa de estoque e a conta a receber (via signals)."""
        consulta = self.get_object()
        if consulta.status != Consulta.Status.REALIZADA:
            return Response(
                {"detail": "Só é possível estornar uma consulta realizada."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )
        consulta.status = Consulta.Status.CANCELADA
        consulta.save(update_fields=["status", "atualizado_em"])
        self._recalcular_vinculos(consulta)
        return Response(self.get_serializer(consulta).data)


class AnamneseViewSet(FiltraPorPacienteMixin, viewsets.ModelViewSet):
    """CRUD de anamneses (paciente e, opcionalmente, consulta). Filtra por `?paciente=`."""

    queryset = Anamnese.objects.all()
    serializer_class = AnamneseSerializer


class FichaViewSet(FiltraPorPacienteMixin, viewsets.ModelViewSet):
    """CRUD de fichas clínicas (odontograma + anotações). Filtra por `?paciente=`."""

    queryset = Ficha.objects.all()
    serializer_class = FichaSerializer
