"""
Permissões e guardas de acesso para o Painel de Admin da Plataforma (Vendor Admin).
"""

from django.http import Http404
from rest_framework.permissions import BasePermission


class IsVendorHost(BasePermission):
    """
    Garante que a requisição está sendo executada no schema `public` (host da plataforma).
    Se a requisição for feita a partir do subdomínio de um tenant, retorna 404 (Not Found)
    para camuflar e ocultar a existência dos endpoints administrativos.
    """

    def has_permission(self, request, view):
        tenant = getattr(request, "tenant", None)
        if tenant is None or tenant.schema_name != "public":
            raise Http404("Página não encontrada.")
        return True


class IsVendorStaff(BasePermission):
    """
    Exige que a requisição esteja no host público e o usuário seja operador staff (is_staff ou is_superuser).
    """

    def has_permission(self, request, view):
        # Valida primeiro o host (404 em tenant)
        tenant = getattr(request, "tenant", None)
        if tenant is None or tenant.schema_name != "public":
            raise Http404("Página não encontrada.")

        return bool(
            request.user
            and request.user.is_authenticated
            and (request.user.is_staff or request.user.is_superuser)
        )


class IsVendorSuperAdmin(BasePermission):
    """
    Exige que a requisição esteja no host público e o usuário seja superadministrador (is_superuser).
    """

    def has_permission(self, request, view):
        tenant = getattr(request, "tenant", None)
        if tenant is None or tenant.schema_name != "public":
            raise Http404("Página não encontrada.")

        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_superuser
        )
