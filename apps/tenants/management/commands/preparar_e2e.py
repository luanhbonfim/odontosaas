"""
Prepara a clínica de testes ponta a ponta (Playwright): `e2e` / `e2e.localhost`.

Idempotente e **restrito ao schema `e2e`**: cria a clínica se não existir e, a cada
execução, devolve os dados ao estado inicial (sem consultas/financeiro/pacientes
residuais; 1 dentista e 1 paciente fixos), para os testes serem determinísticos.

Uso:
    python manage.py preparar_e2e

Credenciais fixas (somente para este tenant de teste local — nunca use em produção):
    e2e-admin@e2e.test / E2e-Senha-2026!
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django_tenants.utils import schema_context

from apps.tenants.models import Clinica

SCHEMA = "e2e"
DOMINIO = "e2e.localhost"
ADMIN_EMAIL = "e2e-admin@e2e.test"
ADMIN_SENHA = "E2e-Senha-2026!"
PACIENTE_NOME = "Paciente E2E"
PACIENTE_CPF = "52998224725"  # CPF válido (dígitos verificadores corretos)
DENTISTA_NOME = "Dra. E2E"


class Command(BaseCommand):
    help = "Cria/zera a clínica de testes E2E (schema 'e2e')."

    def handle(self, *args, **options):
        if not Clinica.objects.filter(schema_name=SCHEMA).exists():
            call_command(
                "provisionar_clinica",
                schema=SCHEMA,
                nome="Clínica E2E",
                dominio=DOMINIO,
                admin_email=ADMIN_EMAIL,
                admin_senha=ADMIN_SENHA,
            )
        elif not Clinica.objects.get(schema_name=SCHEMA).ativo:
            raise CommandError("A clínica 'e2e' existe mas está inativa.")

        # Sem plano => sem limites: um plano de teste anterior não deve vazar para a suíte.
        Clinica.objects.filter(schema_name=SCHEMA).update(plano_assinatura=None)

        from apps.agenda.models import Anamnese, Consulta, Ficha
        from apps.dentistas.models import Dentista
        from apps.financeiro.models import Fatura, LancamentoFinanceiro
        from apps.pacientes.models import Guia, Paciente, PlanoOdontologico
        from apps.usuarios.models import Usuario

        with schema_context(SCHEMA):
            # Ordem respeita as FKs (PROTECT): dependentes primeiro.
            LancamentoFinanceiro.objects.all().delete()
            Fatura.objects.all().delete()
            Guia.objects.all().delete()
            Ficha.objects.all().delete()
            Anamnese.objects.all().delete()
            Consulta.objects.all().delete()
            PlanoOdontologico.objects.all().delete()
            Paciente.objects.all().delete()
            Dentista.objects.all().delete()

            usuario, _ = Usuario.objects.get_or_create(
                email=ADMIN_EMAIL, defaults={"papel": Usuario.Papel.ADMIN}
            )
            usuario.papel = Usuario.Papel.ADMIN
            usuario.is_active = True
            usuario.set_password(ADMIN_SENHA)
            usuario.save()

            Dentista.objects.create(nome_completo=DENTISTA_NOME, cro="E2E-0001")
            Paciente.objects.create(nome_completo=PACIENTE_NOME, cpf=PACIENTE_CPF)

        self.stdout.write(self.style.SUCCESS(f"Clínica E2E pronta em http://{DOMINIO}:5173"))
