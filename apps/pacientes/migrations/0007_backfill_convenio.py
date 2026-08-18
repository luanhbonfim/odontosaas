"""Backfill: cria convênios a partir das operadoras já usadas nos planos e vincula.

Roda por schema de tenant (django-tenants). Semeia o catálogo de convênios com o
que a clínica já tinha digitado e liga cada plano ao convênio correspondente.
A string `operadora` é mantida (o faturamento continua usando-a).
"""

from django.db import migrations


def backfill(apps, schema_editor):
    Convenio = apps.get_model("convenios", "Convenio")
    Plano = apps.get_model("pacientes", "PlanoOdontologico")
    for plano in Plano.objects.filter(convenio__isnull=True).exclude(operadora=""):
        convenio, _ = Convenio.objects.get_or_create(nome=plano.operadora)
        plano.convenio = convenio
        plano.save(update_fields=["convenio"])


def desfazer(apps, schema_editor):
    Plano = apps.get_model("pacientes", "PlanoOdontologico")
    Plano.objects.update(convenio=None)


class Migration(migrations.Migration):
    dependencies = [
        ("pacientes", "0006_planoodontologico_convenio"),
        ("convenios", "0001_initial"),
    ]

    operations = [migrations.RunPython(backfill, desfazer)]
