"""Provisiona o tenant público (schema `public`) e seus domínios locais."""

from django.db import migrations


def criar_tenant_publico(apps, schema_editor):
    Clinica = apps.get_model("tenants", "Clinica")
    Dominio = apps.get_model("tenants", "Dominio")

    # O schema `public` já existe; aqui criamos apenas a linha do tenant.
    publico, _ = Clinica.objects.get_or_create(
        schema_name="public",
        defaults={
            "nome_fantasia": "Público",
            "razao_social": "Plataforma OdontoSaaS",
        },
    )
    Dominio.objects.get_or_create(
        domain="localhost",
        defaults={"tenant": publico, "is_primary": True},
    )
    Dominio.objects.get_or_create(
        domain="127.0.0.1",
        defaults={"tenant": publico, "is_primary": False},
    )


def remover_tenant_publico(apps, schema_editor):
    Clinica = apps.get_model("tenants", "Clinica")
    Dominio = apps.get_model("tenants", "Dominio")
    Dominio.objects.filter(domain__in=["localhost", "127.0.0.1"]).delete()
    Clinica.objects.filter(schema_name="public").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("tenants", "0002_clinica_razao_social_clinica_telefone"),
    ]

    operations = [
        migrations.RunPython(criar_tenant_publico, remover_tenant_publico),
    ]
