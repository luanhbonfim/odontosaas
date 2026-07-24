"""Serializers do app dentistas."""

from rest_framework import serializers

from .models import Dentista


class DentistaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dentista
        fields = [
            "id",
            "nome_completo",
            "cro",
            "especialidades",
            "telefone",
            "email",
            "usuario",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]
        # O `cro` herda o UniqueValidator do model (unique=True) -> valida CRO único.
