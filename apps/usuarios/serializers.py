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
    modulos = serializers.DictField(child=serializers.BooleanField(), required=False)


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
        modulos = (
            tenant.get_modulos_efetivos()
            if hasattr(tenant, "get_modulos_efetivos")
            else {
                "google_calendar": True,
                "sync_google": True,
                "whatsapp": True,
                "whatsapp_waha": True,
                "financeiro": True,
                "estoque": True,
            }
        )
        return {
            "schema": tenant.schema_name,
            "nome_fantasia": tenant.nome_fantasia,
            "modulos": modulos,
        }


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


class MultiTenantTokenObtainPairSerializer(serializers.Serializer):
    """
    Serializer de obtenção de token JWT compatível com multi-tenancy.
    - Se a requisição chega no schema público (host do Vendor), autentica o operador
      localizando seu cadastro em um tenant ativo onde possua flag is_staff ou is_superuser.
    - Se a requisição chega no subdomínio do tenant, autentica normalmente no schema local.
    """

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        from django.db import connection
        from django_tenants.utils import schema_context
        from rest_framework import exceptions
        from rest_framework_simplejwt.tokens import RefreshToken

        from apps.tenants.models import Clinica

        email = attrs.get("email", "").strip()
        password = attrs.get("password", "")

        user = None

        request = self.context.get("request") if hasattr(self, "context") else None
        tenant = getattr(request, "tenant", None) if request else None
        schema_name = getattr(tenant, "schema_name", None) or connection.schema_name

        if schema_name == "public":
            # O schema public é exclusivo da plataforma / vendor. Não permite login de tenant de clínica.
            raise exceptions.AuthenticationFailed(
                "O login de clínicas deve ser realizado através do endereço exclusivo do seu consultório (ex: sua-clinica.proclinica.com.br)."
            )
        else:
            # Usuário da clínica acessando no schema do tenant
            try:
                u = Usuario.objects.get(email__iexact=email)
                if u.check_password(password):
                    user = u
            except Usuario.DoesNotExist:
                user = None

        if not user or not user.is_active:
            raise exceptions.AuthenticationFailed("E-mail ou senha inválidos.")

        refresh = RefreshToken.for_user(user)
        schema_atual = connection.schema_name
        # Injeta claims de isolamento multi-tenant e dados do usuário
        refresh["schema_name"] = schema_atual
        refresh["is_staff"] = user.is_staff
        refresh["is_superuser"] = user.is_superuser
        refresh["email"] = user.email
        refresh["nome"] = user.nome_completo or user.email

        access_token = refresh.access_token
        access_token["schema_name"] = schema_atual
        access_token["is_staff"] = user.is_staff
        access_token["is_superuser"] = user.is_superuser
        access_token["email"] = user.email
        access_token["nome"] = user.nome_completo or user.email

        return {
            "refresh": str(refresh),
            "access": str(access_token),
        }

