"""Backfill: cria uma Ficha para cada Consulta que já tinha dentes/anotações
preenchidos (a "ficha clínica" que vivia embutida na Consulta), vinculando-a
à consulta de origem. Nada se perde ao desacoplar Ficha de Consulta.
"""

from django.db import migrations


def backfill(apps, schema_editor):
    Consulta = apps.get_model("agenda", "Consulta")
    Ficha = apps.get_model("agenda", "Ficha")
    for consulta in Consulta.objects.all():
        if consulta.dentes or consulta.anotacoes:
            Ficha.objects.create(
                paciente_id=consulta.paciente_id,
                consulta_id=consulta.id,
                dentes=consulta.dentes,
                anotacoes=consulta.anotacoes,
            )


class Migration(migrations.Migration):

    dependencies = [
        ("agenda", "0014_ficha"),
    ]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
