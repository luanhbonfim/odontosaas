"""
Provisiona uma nova clínica (tenant): cria o schema, a Clinica e o domínio.

Uso:
    python manage.py provisionar_clinica \
        --schema clinicasorriso \
        --nome "Clínica Sorriso" \
        --dominio clinicasorriso.localhost \
        [--razao-social "Sorriso LTDA"] [--cnpj 12345678000199] \
        [--admin-email admin@sorriso.com --admin-senha SenhaForte123]
"""

from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import schema_context

from apps.tenants.models import Clinica, Dominio


class Command(BaseCommand):
    help = "Cria uma nova clínica (tenant) com schema, domínio e, opcionalmente, um admin."

    def add_arguments(self, parser):
        parser.add_argument("--schema", required=True, help="Nome do schema (ex.: clinicasorriso)")
        parser.add_argument("--nome", required=True, help="Nome fantasia da clínica")
        parser.add_argument(
            "--dominio", required=True, help="Domínio (ex.: clinicasorriso.localhost)"
        )
        parser.add_argument("--razao-social", default="", help="Razão social (opcional)")
        parser.add_argument("--cnpj", default=None, help="CNPJ (opcional)")
        parser.add_argument("--admin-email", default=None, help="E-mail do admin a criar no tenant")
        parser.add_argument("--admin-senha", default=None, help="Senha do admin a criar no tenant")

    def handle(self, *args, **options):
        schema = options["schema"]
        dominio = options["dominio"]

        if Clinica.objects.filter(schema_name=schema).exists():
            raise CommandError(f"Já existe uma clínica com o schema '{schema}'.")
        if Dominio.objects.filter(domain=dominio).exists():
            raise CommandError(f"O domínio '{dominio}' já está em uso.")

        # Salvar a Clinica cria o schema e roda as migrations do tenant.
        clinica = Clinica(
            schema_name=schema,
            nome_fantasia=options["nome"],
            razao_social=options["razao_social"],
            cnpj=options["cnpj"],
        )
        clinica.save()
        Dominio.objects.create(domain=dominio, tenant=clinica, is_primary=True)
        self.stdout.write(
            self.style.SUCCESS(
                f"Clínica '{clinica.nome_fantasia}' criada (schema '{schema}', domínio '{dominio}')."
            )
        )

        from apps.usuarios.models import Usuario
        from apps.usuarios.perfis import sincronizar_grupos

        email = options.get("admin_email")
        senha = options.get("admin_senha")
        from apps.notificacoes.defaults import semear_templates_padrao

        with schema_context(schema):
            # Semeia os grupos de perfis padrão no schema recém-criado.
            sincronizar_grupos()
            # Semeia os templates de WhatsApp padrão (confirmação/cancelamento/agradecimento).
            semear_templates_padrao()
            if email and senha:
                # O signal post_save vincula o usuário ao grupo do seu papel.
                Usuario.objects.create_user(
                    email=email,
                    password=senha,
                    papel=Usuario.Papel.ADMIN,
                    is_staff=True,
                )
        self.stdout.write(self.style.SUCCESS("Grupos de perfis semeados no tenant."))
        if email and senha:
            self.stdout.write(self.style.SUCCESS(f"Usuário ADMIN '{email}' criado no tenant."))
