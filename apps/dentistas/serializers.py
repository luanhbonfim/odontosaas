"""Serializers do app dentistas."""

from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Dentista, Especialidade


class EspecialidadeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Especialidade
        fields = ["id", "nome", "ativo"]


class LoginResumoSerializer(serializers.Serializer):
    """Resumo do login (Usuario) vinculado ao dentista."""

    email = serializers.EmailField()
    ativo = serializers.BooleanField()


class DentistaSerializer(serializers.ModelSerializer):
    # Nomes das especialidades (leitura) para a UI; a escrita continua por IDs.
    especialidades_nomes = serializers.SerializerMethodField()
    # Estado do login vinculado (ou null) — usado pela UI (badge / gerenciar).
    login = serializers.SerializerMethodField()

    class Meta:
        model = Dentista
        fields = [
            "id",
            "nome_completo",
            "cro",
            "especialidades",
            "especialidades_nomes",
            "telefone",
            "email",
            "usuario",
            "login",
            "ativo",
            "criado_em",
            "atualizado_em",
        ]
        # `usuario` NUNCA é escrito pela API de dentistas: o vínculo é gerido em
        # Equipe (UsuarioSerializer.dentista). Deixá-lo gravável aqui permitiria
        # apontar um dentista para o Usuario de um Admin — por isso é só-leitura.
        read_only_fields = ["usuario", "criado_em", "atualizado_em"]
        # O `cro` herda o UniqueValidator do model (unique=True) -> valida CRO único.

    def get_especialidades_nomes(self, obj) -> list[str]:
        return [especialidade.nome for especialidade in obj.especialidades.all()]

    @extend_schema_field(LoginResumoSerializer)
    def get_login(self, obj):
        usuario = obj.usuario
        if usuario is None:
            return None
        return {"email": usuario.email, "ativo": usuario.is_active}
