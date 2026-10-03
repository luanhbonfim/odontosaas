"""Contrato da Busca global (também alimenta o schema OpenAPI)."""

from rest_framework import serializers


class BuscaQuerySerializer(serializers.Serializer):
    q = serializers.CharField(max_length=80, allow_blank=True, default="")


class PacienteBuscaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    nome_completo = serializers.CharField()
    cpf = serializers.CharField(allow_blank=True)
    ativo = serializers.BooleanField()
    telefone_whatsapp = serializers.CharField(allow_blank=True)


class ConsultaBuscaSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    inicio = serializers.DateTimeField()
    status = serializers.CharField()
    paciente_id = serializers.IntegerField()
    paciente_nome = serializers.CharField()
    dentista_nome = serializers.CharField()
    procedimento = serializers.CharField(allow_blank=True)


class BuscaSerializer(serializers.Serializer):
    """Bloco `null` = sem permissão para o módulo (a UI simplesmente não o mostra)."""

    pacientes = PacienteBuscaSerializer(many=True, allow_null=True)
    consultas = ConsultaBuscaSerializer(many=True, allow_null=True)
