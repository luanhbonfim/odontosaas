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
