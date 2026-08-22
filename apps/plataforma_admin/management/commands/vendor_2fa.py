"""
Ativa/desativa o 2FA (TOTP) de um operador do Vendor Admin.

O segredo fica no schema `public` (model `OperadorMFA`), fonte única — não depende
de qual schema de tenant o login encontra o operador Master.

Exemplos:
    # ativar (gera segredo e mostra o otpauth:// para escanear no autenticador):
    python manage.py vendor_2fa --email admin@proclinica.com.br

    # desativar (recuperação, ex.: perdeu o celular):
    python manage.py vendor_2fa --email admin@proclinica.com.br --disable

Depois de ativar, o login no painel passa a exigir o código de 6 dígitos.
"""

import os

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Ativa/desativa o 2FA (TOTP) de um operador do Vendor Admin (schema public)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default=None,
            help="E-mail do operador. Default: MASTER_ADMIN_EMAIL (ou admin@proclinica.com.br).",
        )
        parser.add_argument("--disable", action="store_true", help="Desativa o 2FA do operador.")

    def handle(self, *args, **opts):
        import pyotp

        from apps.plataforma_admin.models import OperadorMFA

        email = (
            opts.get("email")
            or getattr(settings, "MASTER_ADMIN_EMAIL", None)
            or os.environ.get("MASTER_ADMIN_EMAIL")
            or "admin@proclinica.com.br"
        ).strip().lower()

        if opts.get("disable"):
            n, _ = OperadorMFA.objects.filter(email__iexact=email).delete()
            if n:
                self.stdout.write(self.style.SUCCESS(f"2FA DESATIVADO para {email}."))
            else:
                self.stdout.write(self.style.WARNING(f"Nenhum 2FA ativo encontrado para {email}."))
            return

        secret = pyotp.random_base32()
        OperadorMFA.objects.update_or_create(email=email, defaults={"secret": secret})
        uri = pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="PróClínica Vendor")

        self.stdout.write(self.style.SUCCESS(f"2FA ATIVADO para {email}."))
        self.stdout.write("")
        self.stdout.write("Escaneie no Google Authenticator / 1Password / Authy:")
        self.stdout.write(f"  otpauth URI : {uri}")
        self.stdout.write(f"  ou digite o segredo manualmente: {secret}")
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("A partir de agora o login no painel exige o código de 6 dígitos."))
        self.stdout.write("Guarde o segredo com segurança. Perdeu o app? Rode com --disable para resetar.")
