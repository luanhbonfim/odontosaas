"""Serializers do app agenda."""

from rest_framework import serializers

from .models import Anamnese, Consulta


class ConsultaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consulta
        fields = [
            "id",
            "paciente",
            "dentista",
            "inicio",
            "fim",
            "procedimento",
            "status",
            "status_confirmacao",
            "confirmado_em",
            "google_event_id",
            "observacoes",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        # Campos preenchidos pelo sistema (confirmação/sincronização), não pelo cliente.
        read_only_fields = ["confirmado_em", "google_event_id", "criado_em", "atualizado_em"]

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
        """Valida a janela de horário e o conflito de agenda do dentista."""
        inicio = attrs.get("inicio") or getattr(self.instance, "inicio", None)
        fim = attrs.get("fim") or getattr(self.instance, "fim", None)
        dentista = attrs.get("dentista") or getattr(self.instance, "dentista", None)

        if inicio and fim and fim <= inicio:
            raise serializers.ValidationError({"fim": "O fim deve ser posterior ao início."})

        if inicio and fim and dentista:
            # Sobreposição: início < fim_existente E fim > início_existente.
            conflitos = Consulta.objects.filter(
                dentista=dentista, inicio__lt=fim, fim__gt=inicio
            ).exclude(status=Consulta.Status.CANCELADA)
            if self.instance is not None:
                conflitos = conflitos.exclude(pk=self.instance.pk)
            if conflitos.exists():
                raise serializers.ValidationError(
                    "Conflito de horário: o dentista já possui consulta nesse período."
                )
        return attrs


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
