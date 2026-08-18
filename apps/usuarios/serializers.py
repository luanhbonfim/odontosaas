"""Serializers de usuário / autenticação."""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.dentistas.models import Dentista
from apps.usuarios.models import Usuario


def validar_senha(senha, usuario=None):
    """Roda os AUTH_PASSWORD_VALIDATORS; converte o erro do Django em erro do DRF."""
    try:
        validate_password(senha, usuario)
    except DjangoValidationError as erro:
        raise serializers.ValidationError({"senha": list(erro.messages)}) from erro


class ClinicaResumoSerializer(serializers.Serializer):
    """Resumo da clínica (tenant) atual — usado no `/api/auth/me/`."""

    schema = serializers.CharField()
    nome_fantasia = serializers.CharField()


class UsuarioMeSerializer(serializers.ModelSerializer):
    """Dados do usuário autenticado + a clínica (tenant) atual.

    Base do contexto de sessão do frontend (`useSessao()`): nome, papel e a
    clínica a que o usuário pertence.
    """

    papel_display = serializers.CharField(source="get_papel_display", read_only=True)
    clinica = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ["id", "email", "nome_completo", "papel", "papel_display", "clinica"]

    @extend_schema_field(ClinicaResumoSerializer)
    def get_clinica(self, obj):
        tenant = self.context["request"].tenant
        return {"schema": tenant.schema_name, "nome_fantasia": tenant.nome_fantasia}


class UsuarioSerializer(serializers.ModelSerializer):
    """CRUD dos usuários da equipe (Gerente/Admin). Nunca expõe a senha.

    O login pode ser atrelado a um profissional: `dentista` (write) grava o
    vínculo `Dentista.usuario`; `dentista_id`/`dentista_nome` (read) informam o
    dentista atualmente vinculado. A gestão do login vive aqui (Equipe), não no
    cadastro de Dentistas.
    """

    papel_display = serializers.CharField(source="get_papel_display", read_only=True)
    ativo = serializers.BooleanField(source="is_active", required=False)
    senha = serializers.CharField(write_only=True, required=False, style={"input_type": "password"})
    # Vínculo com o profissional (opcional). É a relação reversa de Dentista.usuario.
    dentista = serializers.PrimaryKeyRelatedField(
        queryset=Dentista.objects.all(), required=False, allow_null=True, write_only=True
    )
    dentista_id = serializers.SerializerMethodField()
    dentista_nome = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = [
            "id",
            "email",
            "nome_completo",
            "papel",
            "papel_display",
            "ativo",
            "senha",
            "dentista",
            "dentista_id",
            "dentista_nome",
        ]

    def validate_dentista(self, dentista):
        """Bloqueia atrelar um dentista que já é o login de OUTRO usuário."""
        if dentista is not None and dentista.usuario_id:
            atual = self.instance.id if self.instance else None
            if dentista.usuario_id != atual:
                raise serializers.ValidationError(
                    "Este dentista já está vinculado a outro login."
                )
        return dentista

    def _dentista_vinculado(self, obj):
        try:
            return obj.dentista
        except Dentista.DoesNotExist:
            return None

    def get_dentista_id(self, obj) -> int | None:
        vinculo = self._dentista_vinculado(obj)
        return vinculo.id if vinculo else None

    def get_dentista_nome(self, obj) -> str | None:
        vinculo = self._dentista_vinculado(obj)
        return vinculo.nome_completo if vinculo else None

    def _vincular_dentista(self, usuario, dentista):
        """Aponta `dentista` para `usuario` (OneToOne), desfazendo vínculos antigos."""
        # Solta qualquer outro dentista que apontava para este usuário.
        Dentista.objects.filter(usuario=usuario).exclude(
            pk=getattr(dentista, "pk", None)
        ).update(usuario=None)
        if dentista is not None and dentista.usuario_id != usuario.id:
            dentista.usuario = usuario
            dentista.save(update_fields=["usuario", "atualizado_em"])

    def create(self, validated_data):
        dentista = validated_data.pop("dentista", None)
        senha = validated_data.pop("senha", None)
        if not senha:
            raise serializers.ValidationError({"senha": "Informe a senha."})
        validar_senha(senha)
        is_active = validated_data.pop("is_active", True)
        # O signal `papel→Group` vincula o usuário ao grupo do seu papel ao salvar.
        usuario = Usuario.objects.create_user(password=senha, is_active=is_active, **validated_data)
        self._vincular_dentista(usuario, dentista)
        return usuario

    def update(self, instance, validated_data):
        vincular = "dentista" in validated_data
        dentista = validated_data.pop("dentista", None)
        senha = validated_data.pop("senha", None)
        for atributo, valor in validated_data.items():
            setattr(instance, atributo, valor)
        if senha:
            validar_senha(senha, instance)
            instance.set_password(senha)
        instance.save()
        if vincular:
            self._vincular_dentista(instance, dentista)
        return instance
