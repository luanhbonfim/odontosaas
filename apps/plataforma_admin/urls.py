"""
Roteamento de URLs para o Painel de Admin da Plataforma (Vendor Admin).
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.plataforma_admin.views import (
    PlanoAssinaturaVendorViewSet,
    TenantVendorViewSet,
    MasterAdminVendorViewSet,
    VendorLoginView,
)
from apps.plataforma_admin.views_celery import CeleryTarefasViewSet
from apps.plataforma_admin.views_studio import StudioViewSet

router = DefaultRouter()
router.register("planos", PlanoAssinaturaVendorViewSet, basename="vendor-planos")
router.register("tenants", TenantVendorViewSet, basename="vendor-tenants")
router.register("master-admin", MasterAdminVendorViewSet, basename="vendor-master-admin")
router.register("studio", StudioViewSet, basename="vendor-studio")
router.register("celery/tarefas", CeleryTarefasViewSet, basename="vendor-celery-tarefas")

urlpatterns = [
    path("auth/login/", VendorLoginView.as_view(), name="vendor-auth-login"),
    path("", include(router.urls)),
]

