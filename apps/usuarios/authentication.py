"""
Autenticação JWT customizada compatível com multi-tenancy e schema public.
"""

from django.core.cache import cache
from django.db import connection
from django_tenants.utils import schema_context
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.settings import api_settings

from apps.tenants.models import Clinica


class MultiTenantJWTAuthentication(JWTAuthentication):
    """
    Autenticador JWT seguro compatível com django-tenants.
    - Se a requisição chega no schema público (host da plataforma / Vendor Admin),
      localiza o operador staff/superuser nos tenants ativos onde seu cadastro reside.
    - Se a requisição chega no subdomínio do tenant:
      1. Valida se o claim `schema_name` do token corresponde estritamente ao tenant atual,
         impedindo o replay/forjamento de tokens emitidos para outra clínica (cross-tenant attack).
      2. Valida se sessões de suporte (impersonate) não foram revogadas antecipadamente.
      3. Garante que o usuário autenticado esteja ativo (`is_active = True`).
    """

    def get_user(self, validated_token):
        user_id = validated_token[api_settings.USER_ID_CLAIM]
        token_schema = validated_token.get("schema_name")

        if connection.schema_name == "public":
            # Requisição na plataforma vendor (host público)
            # Requer estritamente token emitido para o schema público (operador)
            if token_schema != "public":
                raise exceptions.AuthenticationFailed(
                    "Token inválido para a plataforma vendor (requer token de operador do schema public).",
                    code="token_tenant_mismatch",
                )

            # 1. Busca direta O(1) se o claim operator_schema estiver presente.
            #    Quando presente, o operator_schema é AUTORITATIVO: o veredito de
            #    privilégio/atividade é decidido nesse schema. Se o cadastro existe
            #    mas perdeu o staff/foi desativado, rejeita imediatamente — sem varrer
            #    outros tenants (o que permitiria autenticar um homônimo de mesmo PK
            #    que ainda seja staff em outra clínica: bypass de de-privilégio).
            operator_schema = validated_token.get("operator_schema")
            if operator_schema and operator_schema != "public":
                with schema_context(operator_schema):
                    try:
                        user = self.user_model.objects.get(**{api_settings.USER_ID_FIELD: user_id})
                    except self.user_model.DoesNotExist:
                        user = None
                if user is not None:
                    # Operador do Vendor Admin exige is_superuser (spec §2.2, consistente
                    # com VendorLoginView). Todo token de schema `public` é emitido apenas
                    # para superusuários pelo login; aceitar is_staff aqui seria mais
                    # permissivo que o login e reabriria o risco de escalonamento.
                    if user.is_superuser and user.is_active:
                        return user
                    raise exceptions.AuthenticationFailed(
                        "Operador não encontrado ou sem privilégios de plataforma.",
                        code="user_not_found",
                    )
                # DoesNotExist no operator_schema: cai no fallback legado (tokens antigos).

            # 2. Fallback de varredura por tenants ativos (tokens sem operator_schema).
            #    Também exige is_superuser — nunca autentica um admin de clínica (is_staff).
            tenants = Clinica.objects.exclude(schema_name="public").filter(ativo=True)
            for t in tenants:
                with schema_context(t.schema_name):
                    try:
                        user = self.user_model.objects.get(**{api_settings.USER_ID_FIELD: user_id})
                        if user.is_superuser and user.is_active:
                            return user
                    except self.user_model.DoesNotExist:
                        continue

            raise exceptions.AuthenticationFailed(
                "Operador não encontrado ou sem privilégios de plataforma.",
                code="user_not_found",
            )

        # Contexto de clínica (schema_name != public)
        # 1. Validação estrita de isolamento multi-tenant do token
        if not token_schema or token_schema != connection.schema_name:
            raise exceptions.AuthenticationFailed(
                "Token inválido para esta clínica (origem de outro tenant ou sem identificação de clínica).",
                code="token_tenant_mismatch",
            )

        # 2. Verificação de revogação de sessão de suporte (impersonate)
        if validated_token.get("is_impersonate"):
            revogado_ts = cache.get(f"impersonate_revoked:{connection.schema_name}")
            iat = validated_token.get("iat")
            if revogado_ts is not None and iat is not None and iat < revogado_ts:
                raise exceptions.AuthenticationFailed(
                    "Esta sessão de suporte foi encerrada pela administração da clínica.",
                    code="impersonate_revoked",
                )

        user = super().get_user(validated_token)

        # 3. Garante que o usuário do tenant esteja ativo
        if not user.is_active:
            raise exceptions.AuthenticationFailed(
                "Conta de usuário inativa.",
                code="user_inactive",
            )

        return user

