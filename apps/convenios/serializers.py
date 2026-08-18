"""Serializers do app convênios."""

from rest_framework import serializers

from .models import Convenio


class ConvenioSerializer(serializers.ModelSerializer):
    # Total de pacientes distintos com plano neste convênio (anotado na view;
    # fallback por consulta quando não anotado, ex.: logo após criar).
    pacientes = serializers.SerializerMethodField()

    class Meta:
        model = Convenio
        fields = ["id", "nome", "pacientes", "ativo", "criado_em", "atualizado_em"]
        read_only_fields = ["criado_em", "atualizado_em"]
        # `nome` herda o UniqueValidator (unique=True) -> valida nome único.

    def get_pacientes(self, obj) -> int:
        contagem = getattr(obj, "pacientes_count", None)
        if contagem is not None:
            return contagem
        return obj.planos.values("paciente").distinct().count()
