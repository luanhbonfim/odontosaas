"""
Backup do schema de um tenant via pg_dump.

Uso:
    python manage.py backup_tenant --schema clinicasorriso [--saida backup.sql]

Agendável por cron/Celery para uma rotina de backup por schema.
"""

import os
import subprocess

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.tenants.models import Clinica


class Command(BaseCommand):
    help = "Gera um backup (pg_dump) do schema de um tenant."

    def add_arguments(self, parser):
        parser.add_argument("--schema", required=True, help="Nome do schema do tenant")
        parser.add_argument("--saida", default=None, help="Arquivo .sql de saída (opcional)")

    def handle(self, *args, **options):
        schema = options["schema"]
        if not Clinica.objects.filter(schema_name=schema).exists():
            raise CommandError(f"Tenant '{schema}' não encontrado.")

        saida = options["saida"] or f"backup_{schema}.sql"
        db = settings.DATABASES["default"]
        comando = [
            "pg_dump",
            "--host",
            str(db.get("HOST", "")),
            "--port",
            str(db.get("PORT", "")),
            "--username",
            str(db.get("USER", "")),
            "--dbname",
            str(db.get("NAME", "")),
            "--schema",
            schema,
            "--no-owner",
            "--file",
            saida,
        ]
        env = {**os.environ, "PGPASSWORD": str(db.get("PASSWORD", ""))}
        resultado = subprocess.run(comando, env=env, capture_output=True, text=True)
        if resultado.returncode != 0:
            raise CommandError(f"Falha no pg_dump: {resultado.stderr}")
        self.stdout.write(self.style.SUCCESS(f"Backup do schema '{schema}' gerado em {saida}."))
