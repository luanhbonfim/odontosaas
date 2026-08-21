"""Middlewares do projeto OdontoSaaS."""

from django.db import connection
from django.http import JsonResponse


class HealthCheckMiddleware:
    """
    Responde aos endpoints de saúde ANTES da resolução de tenant.

    - `/health/`       liveness  — a aplicação está de pé (não toca no banco).
    - `/health/ready/` readiness — verifica a conectividade com o banco.

    Em um projeto django-tenants, o TenantMainMiddleware exige um tenant para
    o domínio da requisição. O healthcheck do container (Docker/CI) precisa
    funcionar de forma robusta, sem depender de tenant nem de migrations —
    por isso interceptamos aqui, no topo da pilha de middlewares.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/health/":
            return JsonResponse({"status": "ok"})
        if request.path == "/health/ready/":
            return self._readiness()
        return self.get_response(request)

    def _readiness(self):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception as exc:
            return JsonResponse({"status": "erro", "detalhe": str(exc)}, status=503)
        return JsonResponse({"status": "ok", "db": "ok"})


class TenantStatusMiddleware:
    """
    Verifica se a clínica (tenant resolvido) está ativa e adimplente.

    - Se a requisição for para o schema `public` (plataforma/vendor), passa direto.
    - Se a clínica estiver inativa (`ativo=False`) ou com assinatura suspensa (`INADIMPLENTE`/`CANCELADA`),
      bloqueia o acesso imediatamente com HTTP 403 Forbidden.
    - Isenta endpoints essenciais (health, estáticos e identificação de tenant).
    """

    ROTAS_ISENTAS_PREFIXOS = (
        "/health/",
        "/static/",
        "/media/",
        "/api/tenant-atual/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        tenant = getattr(request, "tenant", None)

        # Schema public (plataforma) ou requisição sem tenant não é barrado aqui
        if tenant is None or getattr(tenant, "schema_name", "") == "public":
            return self.get_response(request)

        # Rotas isentas
        if any(request.path.startswith(prefixo) for prefixo in self.ROTAS_ISENTAS_PREFIXOS):
            return self.get_response(request)

        # Verifica se o tenant pode acessar o sistema
        pode_acessar = getattr(tenant, "pode_acessar_sistema", None)
        if callable(pode_acessar):
            bloqueado = not pode_acessar()
        else:
            bloqueado = not getattr(tenant, "ativo", True)

        if bloqueado:
            status_assinatura = getattr(tenant, "status_assinatura", "")
            vigencia_fim = getattr(tenant, "vigencia_fim", None)
            import datetime
            from django.utils import timezone
            if isinstance(vigencia_fim, datetime.date) and vigencia_fim < timezone.localdate():
                motivo = "expirado"
                mensagem = f"A vigência do plano desta clínica expirou em {vigencia_fim.strftime('%d/%m/%Y')}. Entre em contato com a administração."
            elif not getattr(tenant, "ativo", True):
                motivo = "inativo"
                mensagem = "Esta clínica foi temporariamente desativada pela administração."
            else:
                motivo = str(status_assinatura).lower()
                mensagem = "A assinatura desta clínica está inativa ou suspensa. Entre em contato com o suporte da plataforma."

            if request.path.startswith("/api/"):
                return JsonResponse(
                    {
                        "erro": "Acesso suspenso.",
                        "motivo": motivo,
                        "mensagem": mensagem,
                    },
                    status=403,
                )

            from django.http import HttpResponseForbidden

            return HttpResponseForbidden(
                f"<h1>Acesso Suspenso</h1><p>{mensagem}</p>",
                content_type="text/html; charset=utf-8",
            )

        return self.get_response(request)


class ImpersonateReadOnlyMiddleware:
    """
    Bloqueia mutações (POST, PUT, PATCH, DELETE) quando a requisição usa um token
    de impersonate emitido em modo Somente-Leitura (`impersonate_read_only = True`).
    """

    METODOS_SEGUROS = ("GET", "HEAD", "OPTIONS")
    ROTAS_ISENTAS = (
        "/api/auth/encerrar-suporte/",
        "/api/auth/logout/",
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.method not in self.METODOS_SEGUROS:
            caminho = request.path_info or request.path
            if caminho not in self.ROTAS_ISENTAS and not any(caminho.endswith(r) for r in self.ROTAS_ISENTAS):
                auth_header = request.META.get("HTTP_AUTHORIZATION", "").strip()
                if auth_header.lower().startswith("bearer "):
                    token_str = auth_header[7:].strip()
                    try:
                        import jwt
                        from django.conf import settings

                        secret = getattr(settings, "SECRET_KEY", "")
                        try:
                            payload = jwt.decode(token_str, secret, algorithms=["HS256"])
                        except Exception:
                            payload = jwt.decode(token_str, options={"verify_signature": False})

                        if payload.get("is_impersonate") and payload.get("impersonate_read_only"):
                            return JsonResponse(
                                {
                                    "erro": "Acesso de suporte em modo somente-leitura.",
                                    "mensagem": (
                                        "Esta sessão de suporte está em modo Read-Only. "
                                        "Mutações (POST/PUT/PATCH/DELETE) são bloqueadas para proteger os dados do tenant."
                                    ),
                                },
                                status=403,
                            )
                    except Exception:
                        pass

        return self.get_response(request)


