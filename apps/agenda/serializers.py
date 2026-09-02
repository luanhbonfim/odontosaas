"""Serializers do app agenda."""

from django.utils import timezone
from rest_framework import serializers

from .models import Anamnese, Consulta, Ficha


class ConsultaSerializer(serializers.ModelSerializer):
    # Nomes resolvidos para exibição (ex.: título do evento na agenda).
    paciente_nome = serializers.CharField(source="paciente.nome_completo", read_only=True)
    dentista_nome = serializers.CharField(source="dentista.nome_completo", read_only=True)
    convenio_nome = serializers.SerializerMethodField()
    procedimento_catalogo_nome = serializers.CharField(
        source="procedimento_catalogo.nome", read_only=True, default=None
    )
    # Estado da sincronização com o Google Calendar (do AgendaEvento espelho).
    sync_google = serializers.SerializerMethodField()

    class Meta:
        model = Consulta
        fields = [
            "id",
            "paciente",
            "paciente_nome",
            "dentista",
            "dentista_nome",
            "inicio",
            "fim",
            "procedimento",
            "procedimento_catalogo",
            "procedimento_catalogo_nome",
            "convenio",
            "convenio_nome",
            "valor",
            "forma_pagamento",
            "parcelas",
            "data_primeira_parcela",
            "status",
            "status_confirmacao",
            "confirmado_em",
            "google_event_id",
            "sync_google",
            "observacoes",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        # Campos preenchidos pelo sistema (confirmação/sincronização), não pelo cliente.
        read_only_fields = ["confirmado_em", "google_event_id", "criado_em", "atualizado_em"]

    def get_convenio_nome(self, obj) -> str | None:
        return obj.convenio.nome if obj.convenio_id else None

    def get_sync_google(self, obj) -> str | None:
        # Pode haver 1 evento por agenda (clínica/dentista); reporta o mais recente.
        evento = obj.eventos_google.order_by("-ultima_sincronizacao", "-id").first()
        return evento.status_sync if evento else None

    def validate_parcelas(self, valor):
        if valor < 1:
            raise serializers.ValidationError("Deve ser pelo menos 1 parcela.")
        return valor

    def validate_status(self, novo_status):
        """Na atualização, só permite transições válidas do ciclo de vida."""
        if (
            self.instance
            and novo_status != self.instance.status
            and not self.instance.pode_transicionar_para(novo_status)
        ):
            raise serializers.ValidationError(
                f"Transição inválida: {self.instance.status} -> {novo_status}."
            )
        return novo_status

    def validate(self, attrs):
        """Valida horário, agendamento no passado, conflitos (dentista/paciente) e convênio vencido."""
        inicio = attrs.get("inicio") or getattr(self.instance, "inicio", None)
        fim = attrs.get("fim") or getattr(self.instance, "fim", None)
        dentista = attrs.get("dentista") or getattr(self.instance, "dentista", None)
        paciente = attrs.get("paciente") or getattr(self.instance, "paciente", None)
        convenio = attrs.get("convenio") or getattr(self.instance, "convenio", None)
        status_atual = attrs.get("status") or getattr(
            self.instance, "status", Consulta.Status.AGENDADA
        )

        if inicio and fim and fim <= inicio:
            raise serializers.ValidationError({"fim": "O fim deve ser posterior ao início."})

        # Convênio vencido: não deixa agendar por ele (defesa; o front também avisa).
        if convenio and paciente:
            from apps.pacientes.models import PlanoOdontologico

            plano = (
                PlanoOdontologico.objects.filter(paciente=paciente, convenio=convenio)
                .order_by("-validade")
                .first()
            )
            if plano and plano.validade and plano.validade < timezone.localdate():
                raise serializers.ValidationError(
                    {"convenio": "Convênio vencido: renove a validade do plano para agendar por ele."}
                )

        # N3: não agendar no passado; permite lançar atendimento já ocorrido (REALIZADA/FALTOU).
        agendavel = {Consulta.Status.AGENDADA, Consulta.Status.EM_ATENDIMENTO}
        if inicio and status_atual in agendavel and inicio < timezone.now():
            raise serializers.ValidationError(
                {"inicio": "Não é possível agendar uma consulta no passado."}
            )

        if inicio and fim:
            # Sobreposição: início < fim_existente E fim > início_existente.
            if dentista and self._ha_conflito(dentista=dentista, inicio=inicio, fim=fim):
                raise serializers.ValidationError(
                    "Conflito de horário: o dentista já possui consulta nesse período."
                )
            # N8: o paciente também não pode estar em duas consultas ao mesmo tempo.
            if paciente and self._ha_conflito(paciente=paciente, inicio=inicio, fim=fim):
                raise serializers.ValidationError(
                    "Conflito de horário: o paciente já possui consulta nesse período."
                )
        return attrs

    def _ha_conflito(self, *, inicio, fim, dentista=None, paciente=None):
        """Há outra consulta (não cancelada) sobrepondo esse período para o alvo?"""
        alvo = {"dentista": dentista} if dentista is not None else {"paciente": paciente}
        conflitos = Consulta.objects.filter(inicio__lt=fim, fim__gt=inicio, **alvo).exclude(
            status=Consulta.Status.CANCELADA
        )
        if self.instance is not None:
            conflitos = conflitos.exclude(pk=self.instance.pk)
        return conflitos.exists()


class AnamneseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Anamnese
        fields = [
            "id",
            "paciente",
            "consulta",
            "queixa_principal",
            "historico_medico",
            "pressao_arterial",
            "fumante",
            "diabetico",
            "gestante",
            "registrado_por",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate(self, attrs):
        """A consulta vinculada deve ser do mesmo paciente da anamnese (G1)."""
        consulta = attrs.get("consulta") or getattr(self.instance, "consulta", None)
        paciente = attrs.get("paciente") or getattr(self.instance, "paciente", None)
        if consulta and paciente and consulta.paciente_id != paciente.id:
            raise serializers.ValidationError(
                {"consulta": "A consulta deve ser do mesmo paciente da anamnese."}
            )
        return attrs


class FichaSerializer(serializers.ModelSerializer):
    paciente_nome = serializers.CharField(source="paciente.nome_completo", read_only=True)
    consulta_inicio = serializers.DateTimeField(
        source="consulta.inicio", read_only=True, default=None
    )
    consulta_dentista_nome = serializers.CharField(
        source="consulta.dentista.nome_completo", read_only=True, default=None
    )

    class Meta:
        model = Ficha
        fields = [
            "id",
            "paciente",
            "paciente_nome",
            "consulta",
            "consulta_inicio",
            "consulta_dentista_nome",
            "dentes",
            "anotacoes",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]

    def validate(self, attrs):
        """A consulta vinculada deve ser do mesmo paciente da ficha (mesma regra da anamnese)."""
        consulta = attrs.get("consulta") or getattr(self.instance, "consulta", None)
        paciente = attrs.get("paciente") or getattr(self.instance, "paciente", None)
        if consulta and paciente and consulta.paciente_id != paciente.id:
            raise serializers.ValidationError(
                {"consulta": "A consulta deve ser do mesmo paciente da ficha."}
            )
        return attrs
