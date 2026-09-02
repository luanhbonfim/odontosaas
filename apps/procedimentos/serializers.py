"""Serializers do app procedimentos."""

from rest_framework import serializers

from .models import Procedimento


class ProcedimentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Procedimento
        fields = ["id", "nome", "valor", "ativo", "criado_em", "atualizado_em"]
        read_only_fields = ["criado_em", "atualizado_em"]
        # `nome` herda o UniqueValidator (unique=True) -> valida nome único.
