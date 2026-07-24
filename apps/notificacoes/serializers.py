"""Serializers do app notificacoes."""

from rest_framework import serializers

from .models import ConfiguracaoNotificacao, TemplateMensagem


class ConfiguracaoNotificacaoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracaoNotificacao
        fields = [
            "id",
            "dias_antecedencia",
            "horario_envio",
            "waha_session",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        read_only_fields = ["criado_em", "atualizado_em"]


class TemplateMensagemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TemplateMensagem
        fields = ["id", "tipo", "corpo", "ativo", "criado_em", "atualizado_em"]
        read_only_fields = ["criado_em", "atualizado_em"]
