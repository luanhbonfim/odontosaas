"""Migra usuários com o papel removido `FINANCEIRO` para `ADMIN`.

Roda por-tenant (django-tenants) durante o migrate. Precaução: normalmente não
há usuários com esse papel, mas garante consistência após removê-lo do enum.
"""

from django.db import migrations


def financeiro_para_admin(apps, schema_editor):
    Usuario = apps.get_model("usuarios", "Usuario")
    Usuario.objects.filter(papel="FINANCEIRO").update(papel="ADMIN")


class Migration(migrations.Migration):
    dependencies = [
        ("usuarios", "0002_alter_usuario_papel"),
    ]

    operations = [
        migrations.RunPython(financeiro_para_admin, migrations.RunPython.noop),
    ]
