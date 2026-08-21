import logging
import re
import traceback
from django.conf import settings
from django.db import connection
from rest_framework import status
from rest_framework.exceptions import (
    AuthenticationFailed,
    NotAuthenticated,
    PermissionDenied,
    ValidationError,
)
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)

# Padrões regex para sanitização de dados sensíveis em logs e tracebacks
REGEX_SENSIBILIDADES = [
    # URLs de banco de dados: postgres://user:pass@host:port/db
    (re.compile(r"(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)", re.IGNORECASE), r"\1[SENHA_DB_REDIGIDA]\3"),
    # Tokens Bearer / JWT (com prefixo "Bearer ")
    (re.compile(r"(Bearer\s+)[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+(?:\.[A-Za-z0-9\-_.+/=]*)?", re.IGNORECASE), r"\1[TOKEN_JWT_REDIGIDO]"),
    # JWT "cru" (sem prefixo) — todo JWT começa com "eyJ" (base64 de '{"'). Cobre tokens
    # embutidos em mensagens de erro do SimpleJWT/PyJWT (ex.: "Invalid token eyJhbGci...").
    (re.compile(r"eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+(?:\.[A-Za-z0-9\-_.+/=]*)?"), r"[TOKEN_JWT_REDIGIDO]"),
    # Chaves de API e senhas em JSON/Query strings/kwargs — valor com OU sem aspas
    # (ex.: password=hunter2, "token": "abc", ?access_token=xyz&...).
    (re.compile(r"((?:senha|password|secret|token|api_key|access_token|refresh_token|waha_key|authorization)['\"]?\s*[:=]\s*)['\"]?[^'\"\s,;&}]+['\"]?", re.IGNORECASE), r"\1[DADO_CONFIDENCIAL_REDIGIDO]"),
]


def sanitizar_texto_sensivel(texto: str) -> str:
    """Remove ou mascara credenciais de banco, senhas e tokens de textos e tracebacks."""
    if not texto:
        return ""
    limpo = str(texto)
    for padrao, subst in REGEX_SENSIBILIDADES:
        limpo = padrao.sub(subst, limpo)
    return limpo


def custom_exception_handler(exc, context):
    """
    Handler global de exceções do Django REST Framework.
    Captura e registra automaticamente erros operacionais no RegistroErroOperacional
    do painel vendor, com sanitização rigorosa de credenciais e sem vazar dados em 500.
    """
    response = exception_handler(exc, context)
    request = context.get("request")

    # 1. Determina o schema do tenant
    schema_name = "public"
    if request:
        tenant = getattr(request, "tenant", None)
        if tenant and getattr(tenant, "schema_name", None):
            schema_name = tenant.schema_name
        elif hasattr(connection, "schema_name") and connection.schema_name:
            schema_name = connection.schema_name

    # O header X-Tenant-Id só é honrado para operadores autenticados do vendor
    # (staff/superuser). Sem isso, um chamador anônimo no host público poderia
    # forjar o header e envenenar o painel de erros de qualquer clínica existente.
    if schema_name == "public" and request:
        usuario = getattr(request, "user", None)
        operador_confiavel = bool(
            usuario is not None
            and getattr(usuario, "is_authenticated", False)
            and (getattr(usuario, "is_staff", False) or getattr(usuario, "is_superuser", False))
        )
        if operador_confiavel:
            header_tenant = (request.headers.get("X-Tenant-Id") or request.headers.get("X-Tenant") or "").strip().lower()
            if header_tenant and header_tenant.replace("_", "").isalnum():
                from apps.tenants.models import Clinica
                if Clinica.objects.filter(schema_name=header_tenant).exists():
                    schema_name = header_tenant

    endpoint = request.path if request else ""
    metodo = request.method if request else ""
    exc_name = exc.__class__.__name__

    # 2. Ignora requisições de autenticação corriqueiras (login errado ou refresh expirado)
    if isinstance(exc, (NotAuthenticated, AuthenticationFailed)) and (
        "/api/auth/token/" in endpoint
        or "/api/auth/login/" in endpoint
        or "/api/auth/refresh/" in endpoint
    ):
        return response

    # 3. Extrai mensagem amigável e legível do erro com sanitização de campos confidenciais
    CAMPOS_SENSIVEIS = ("senha", "password", "token", "secret", "access", "refresh", "key", "authorization")
    mensagem = ""
    if response is not None and isinstance(response.data, (dict, list)):
        if isinstance(response.data, dict):
            if "detail" in response.data:
                mensagem = str(response.data["detail"])
            elif "erro" in response.data:
                mensagem = str(response.data["erro"])
            elif "non_field_errors" in response.data:
                itens = response.data["non_field_errors"]
                mensagem = "; ".join(str(e) for e in (itens if isinstance(itens, list) else [itens]))
            else:
                partes = []
                for k, v in response.data.items():
                    if any(s in str(k).lower() for s in CAMPOS_SENSIVEIS):
                        v_str = "[DADO CONFIDENCIAL REDIGIDO]"
                    elif isinstance(v, list):
                        v_str = ", ".join(str(item) for item in v)
                    else:
                        v_str = str(v)
                    partes.append(f"{k}: {v_str}")
                mensagem = "; ".join(partes)
        elif isinstance(response.data, list):
            mensagem = "; ".join(str(e) for e in response.data)

    if not mensagem:
        mensagem = str(exc) or "Erro operacional não especificado."

    # Sanitização profunda da mensagem de erro
    mensagem = sanitizar_texto_sensivel(mensagem)

    # 4. Classificação automática de Nível, Tipo e Módulo
    nivel = "ERROR"
    tipo_erro = exc_name

    msg_lower = mensagem.lower()
    if "conflito" in msg_lower or "sobreposição" in msg_lower or "sobreposto" in msg_lower:
        tipo_erro = "ScheduleConflictWarning"
        nivel = "WARNING"
    elif "limite" in msg_lower or "atingido" in msg_lower or "excedido" in msg_lower or "capacidade" in msg_lower:
        tipo_erro = "QuotaExceededWarning"
        nivel = "WARNING"
    elif isinstance(exc, ValidationError):
        tipo_erro = "ValidationError"
        nivel = "WARNING"
    elif isinstance(exc, PermissionDenied):
        tipo_erro = "PermissionDenied"
        nivel = "WARNING"

    tb_str = ""
    if response is None:
        tb_str = sanitizar_texto_sensivel(traceback.format_exc())
        nivel = "CRITICAL"
        tipo_erro = exc_name
        corpo_500 = {"detail": "Erro interno do servidor."}
        if getattr(settings, "DEBUG", False):
            corpo_500["erro"] = sanitizar_texto_sensivel(str(exc))
        response = Response(corpo_500, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    elif response.status_code >= 500:
        tb_str = sanitizar_texto_sensivel(traceback.format_exc())
        nivel = "CRITICAL"

    # Módulo
    modulo = "Geral"
    if endpoint:
        partes = [p for p in endpoint.strip("/").split("/") if p and p != "api"]
        if partes:
            modulo_raw = partes[0]
            modulo = {
                "agenda": "Agenda",
                "pacientes": "Pacientes & Prontuário",
                "dentistas": "Dentistas",
                "usuarios": "Usuários & Acessos",
                "financeiro": "Financeiro",
                "procedimentos": "Procedimentos",
                "tratamentos": "Tratamentos",
                "integracoes": "Integrações",
                "notificacoes": "Notificações & WhatsApp",
                "plataforma": "Plano & Assinatura",
                "plataforma-admin": "Plataforma Admin",
            }.get(modulo_raw, modulo_raw.replace("-", " ").capitalize())

    # 5. Gravação automática do registro de erro operacional
    try:
        if schema_name and schema_name != "public":
            from apps.plataforma_admin.services import registrar_erro_operacional

            registrar_erro_operacional(
                schema_tenant=schema_name,
                mensagem=mensagem,
                nivel=nivel,
                endpoint=endpoint,
                metodo=metodo,
                traceback=tb_str,
                detalhes={
                    "modulo": modulo,
                    "tipo_erro": tipo_erro,
                    "origem": f"API: {metodo} {endpoint}",
                    "status_code": response.status_code if response else 500,
                },
            )
    except Exception as e:
        logger.warning(f"Falha ao registrar log de erro operacional para tenant {schema_name}: {e}")

    return response

