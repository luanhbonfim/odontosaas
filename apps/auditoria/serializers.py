"""Serializers do app auditoria."""

from rest_framework import serializers

from .models import RegistroAuditoria


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.SerializerMethodField()
    acao_rotulo = serializers.CharField(source="get_acao_display", read_only=True)

    class Meta:
        model = RegistroAuditoria
        fields = [
            "id",
            "acao",
            "acao_rotulo",
            "modelo",
            "objeto_id",
            "objeto_repr",
            "usuario",
            "usuario_nome",
            "criado_em",
        ]
        read_only_fields = fields

    def get_usuario_nome(self, obj) -> str:
        """Nome de quem agiu ('' = ação do sistema/sem usuário, ex.: Celery)."""
        if not obj.usuario_id:
            return ""
        return obj.usuario.nome_completo or obj.usuario.email
