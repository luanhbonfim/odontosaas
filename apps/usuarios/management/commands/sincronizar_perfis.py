"""Cria/atualiza os grupos de perfis e revincula os usuários em cada tenant.

Útil para clínicas já existentes (que não passaram pelo `provisionar_clinica`
atualizado). Novos tenants já recebem os grupos no provisionamento.

    python manage.py sincronizar_perfis
"""

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand
from django_tenants.utils import get_tenant_model, schema_context

from apps.usuarios.models import Usuario
from apps.usuarios.perfis import sincronizar_grupos


class Command(BaseCommand):
    help = "Semeia os grupos de perfis e revincula os usuários ao grupo do seu papel, por tenant."

    def handle(self, *args, **options):
        for tenant in get_tenant_model().objects.exclude(schema_name="public"):
            with schema_context(tenant.schema_name):
                sincronizar_grupos()
                for usuario in Usuario.objects.all():
                    grupo = Group.objects.filter(name=usuario.papel).first()
                    if grupo is not None:
                        usuario.groups.set([grupo])
            self.stdout.write(
                self.style.SUCCESS(f"Perfis sincronizados no tenant '{tenant.schema_name}'.")
            )
