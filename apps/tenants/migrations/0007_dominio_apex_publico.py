"""
Registra o domínio APEX (raiz) para o tenant público, para o SPA renderizar a
landing de vendas em https://proclinica.cloud (e www).

Sem essa linha, o django-tenants rejeita o host raiz com 404 ANTES da view e a
landing (que o Caddy passou a servir no apex) não conseguiria resolver o tenant
público via /api/tenant-atual/.

O domínio pode ser sobrescrito por ambiente com APEX_DOMAIN (default proclinica.cloud).
Idempotente: get_or_create não duplica nem sobrescreve.
"""

import os

from django.db import migrations

APEX = (os.environ.get("APEX_DOMAIN") or "proclinica.cloud").strip().lower()


def criar_dominios_apex(apps, schema_editor):
    Clinica = apps.get_model("tenants", "Clinica")
    Dominio = apps.get_model("tenants", "Dominio")

    publico = Clinica.objects.filter(schema_name="public").first()
    if publico is None:
        # Ambiente sem tenant público ainda; nada a fazer.
        return

    for dominio in (APEX, f"www.{APEX}"):
        Dominio.objects.get_or_create(
            domain=dominio, defaults={"tenant": publico, "is_primary": False}
        )


def remover_dominios_apex(apps, schema_editor):
    Dominio = apps.get_model("tenants", "Dominio")
    Dominio.objects.filter(domain__in=[APEX, f"www.{APEX}"]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0006_clinica_responsavel_cpf_clinica_responsavel_email_and_more"),
    ]

    operations = [
        migrations.RunPython(criar_dominios_apex, remover_dominios_apex),
    ]
