"""Serializers do app auditoria."""

from rest_framework import serializers

from .models import RegistroAuditoria


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegistroAuditoria
        fields = ["id", "acao", "modelo", "objeto_id", "objeto_repr", "usuario", "criado_em"]
        read_only_fields = fields
