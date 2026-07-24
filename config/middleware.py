"""Middlewares do projeto OdontoSaaS."""

from django.http import JsonResponse


class HealthCheckMiddleware:
    """
    Responde ao endpoint /health/ ANTES da resolução de tenant.

    Em um projeto django-tenants, o TenantMainMiddleware exige um tenant para
    o domínio da requisição. O healthcheck do container (Docker/CI) precisa
    funcionar de forma robusta, sem depender de tenant nem de migrations —
    por isso interceptamos /health/ aqui, no topo da pilha de middlewares.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/health/":
            return JsonResponse({"status": "ok"})
        return self.get_response(request)
