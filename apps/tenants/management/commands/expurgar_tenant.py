"""
Expurgo (remoção) de um tenant — apaga a Clinica e dropa o schema. DESTRUTIVO.

Uso:
    python manage.py expurgar_tenant --schema clinicasorriso --confirmar

Serve ao direito de eliminação (LGPD) e ao offboarding de clínicas.
"""

from django.core.management.base import BaseCommand, CommandError

from apps.tenants.models import Clinica


class Command(BaseCommand):
    help = "Expurga um tenant: remove a Clinica e dropa o schema. Destrutivo!"

    def add_arguments(self, parser):
        parser.add_argument("--schema", required=True, help="Nome do schema do tenant")
        parser.add_argument(
            "--confirmar", action="store_true", help="Confirma a remoção destrutiva"
        )

    def handle(self, *args, **options):
        schema = options["schema"]
        if schema == "public":
            raise CommandError("Não é possível expurgar o schema public.")
        clinica = Clinica.objects.filter(schema_name=schema).first()
        if clinica is None:
            raise CommandError(f"Tenant '{schema}' não encontrado.")
        if not options["confirmar"]:
            raise CommandError("Operação destrutiva: rode com --confirmar para prosseguir.")

        # django-tenants dropa o schema ao deletar a Clinica (force_drop).
        clinica.delete(force_drop=True)
        self.stdout.write(self.style.SUCCESS(f"Tenant '{schema}' expurgado (schema removido)."))
