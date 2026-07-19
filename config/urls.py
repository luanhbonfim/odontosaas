"""
Roteamento de URLs raiz do OdontoSaaS.

As rotas dos apps (dentistas, pacientes, agenda, integrações, notificações,
etc.) serão incluídas aqui nas próximas sprints via `include(...)`.
"""

from django.contrib import admin
from django.http import JsonResponse
from django.urls import path


def healthcheck(_request):
    """Endpoint simples de verificação de saúde (usado por Docker/CI)."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", healthcheck, name="health"),
]
