"""Serializers do app integrações (status da conexão Google — para a UI)."""

from rest_framework import serializers


class ConexaoGoogleSerializer(serializers.Serializer):
    """Estado da conexão Google Calendar de um alvo (clínica ou um dentista)."""

    dentista = serializers.IntegerField(allow_null=True)
    dentista_nome = serializers.CharField()
    conectado = serializers.BooleanField()
    calendar_id = serializers.CharField()
    token_expiry = serializers.DateTimeField(allow_null=True)
    atualizado_em = serializers.DateTimeField(allow_null=True)
