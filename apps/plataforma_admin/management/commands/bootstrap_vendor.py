"""
Bootstrap do Vendor Admin em um ambiente novo (ex.: após zerar o banco).

Faz três coisas (idempotentes):
  1. Mapeia o HOST do painel (subdomínio secreto) para o schema `public`, para o
     painel ficar acessível nesse subdomínio.
  2. Cria um plano de assinatura padrão, se ainda não houver nenhum.
  3. (Opcional) Provisiona a PRIMEIRA clínica — isso semeia o operador Master
     (is_superuser) no schema dela, habilitando o login no painel. A partir daí,
     as demais clínicas podem ser provisionadas pelo próprio painel.

Exemplos:
    # só a fundação (host do painel + plano padrão):
    python manage.py bootstrap_vendor --host ops-a3f9k2.suodominio.cloud

    # fundação + primeira clínica (semeia o Master):
    python manage.py bootstrap_vendor --host ops-a3f9k2.suodominio.cloud \
        --clinica-schema mercadante --clinica-nome "Clínica Mercadante" \
        --clinica-dominio mercadante.suodominio.cloud

O Master usa MASTER_ADMIN_EMAIL / MASTER_ADMIN_PASSWORD do ambiente.
"""

import os

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Prepara o Vendor Admin: host do painel -> public, plano padrão e (opcional) primeira clínica."

    def add_arguments(self, parser):
        parser.add_argument(
            "--host",
            default=os.environ.get("VENDOR_ADMIN_HOST", ""),
            help="Host (subdomínio) do painel, mapeado para o schema public. Default: env VENDOR_ADMIN_HOST.",
        )
        parser.add_argument("--clinica-schema", default=None, help="Schema da primeira clínica (opcional).")
        parser.add_argument("--clinica-nome", default=None, help="Nome fantasia da primeira clínica.")
        parser.add_argument("--clinica-dominio", default=None, help="Domínio (subdomínio) da primeira clínica.")
        parser.add_argument("--admin-email", default=None, help="E-mail do admin da clínica (opcional).")
        parser.add_argument("--admin-senha", default=None, help="Senha do admin da clínica (opcional).")

    def handle(self, *args, **opts):
        from apps.plataforma.models import PlanoAssinatura
        from apps.tenants.models import Clinica, Dominio

        # ---- 1. Host do painel -> public ------------------------------------
        host = (opts.get("host") or "").strip().lower()
        publico = Clinica.objects.filter(schema_name="public").first()
        if publico is None:
            raise CommandError(
                "Tenant public não encontrado. Rode 'migrate_schemas' antes do bootstrap."
            )
        if host:
            _, criado = Dominio.objects.get_or_create(
                domain=host, defaults={"tenant": publico, "is_primary": False}
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Host do painel {'criado' if criado else 'já existia'}: {host} -> schema public"
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    "Nenhum host informado (--host / VENDOR_ADMIN_HOST). O painel só abrirá em hosts que resolvam para public."
                )
            )

        # ---- 2. Plano padrão -------------------------------------------------
        if PlanoAssinatura.objects.exists():
            self.stdout.write("Já existe pelo menos um plano — nenhum plano padrão criado.")
        else:
            plano = PlanoAssinatura.objects.create(
                nome="Piloto",
                preco_mensal=0,
                limite_dentistas=5,
                limite_usuarios=10,
            )
            self.stdout.write(self.style.SUCCESS(f"Plano padrão criado: {plano.nome} (id={plano.id})."))

        # ---- 3. Primeira clínica (semeia o Master) --------------------------
        schema = opts.get("clinica_schema")
        nome = opts.get("clinica_nome")
        dominio = opts.get("clinica_dominio")
        if schema and nome and dominio:
            from apps.plataforma_admin.services import executar_provisionamento_clinica

            plano_id = PlanoAssinatura.objects.order_by("id").values_list("id", flat=True).first()
            clinica = executar_provisionamento_clinica(
                schema_name=schema,
                nome_fantasia=nome,
                dominio=dominio,
                plano_id=plano_id,
                admin_email=opts.get("admin_email"),
                admin_senha=opts.get("admin_senha"),
            )
            self.stdout.write(
                self.style.SUCCESS(
                    f"Clínica '{clinica.nome_fantasia}' provisionada (schema '{schema}'). "
                    "O operador Master foi semeado — já é possível logar no painel."
                )
            )
        elif any([schema, nome, dominio]):
            raise CommandError(
                "Para provisionar a primeira clínica, informe --clinica-schema, --clinica-nome e --clinica-dominio juntos."
            )
        else:
            self.stdout.write(
                "Primeira clínica não provisionada (sem --clinica-*). "
                "Provisione uma clínica para semear o operador Master e habilitar o login no painel."
            )
