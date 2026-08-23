"""
Semeia 3 planos comerciais PADRÃO (idempotente, por nome).

Servem de ponto de partida no deploy — o operador ajusta preços/limites pelo
Vendor Admin depois. `get_or_create(nome=...)` garante que rodar de novo não
duplica e NÃO sobrescreve edições feitas na VPS.
"""

from django.db import migrations

PLANOS = [
    {
        "nome": "Essencial",
        "periodicidade": "MENSAL",
        "preco_mensal": "149.00",
        "preco_anual": "1430.00",  # ~20% off (12x 149 = 1788)
        "limite_dentistas": 2,
        "limite_usuarios": 4,
        "limite_pacientes_ativos": 800,
        "limite_armazenamento_mb": 2048,
        "modulo_financeiro_ativo": False,
        "modulo_estoque_ativo": False,
        "sync_google_ativo": True,
        "whatsapp_waha_ativo": True,
        "ativo": True,
    },
    {
        "nome": "Profissional",
        "periodicidade": "MENSAL",
        "preco_mensal": "279.00",
        "preco_anual": "2680.00",  # ~20% off (12x 279 = 3348)
        "limite_dentistas": 6,
        "limite_usuarios": 12,
        "limite_pacientes_ativos": None,  # ilimitado
        "limite_armazenamento_mb": 10240,
        "modulo_financeiro_ativo": True,
        "modulo_estoque_ativo": True,
        "sync_google_ativo": True,
        "whatsapp_waha_ativo": True,
        "ativo": True,
    },
    {
        "nome": "Premium",
        "periodicidade": "MENSAL",
        "preco_mensal": "499.00",
        "preco_anual": "4790.00",  # ~20% off (12x 499 = 5988)
        "limite_dentistas": None,  # ilimitado
        "limite_usuarios": None,
        "limite_pacientes_ativos": None,
        "limite_armazenamento_mb": 51200,
        "modulo_financeiro_ativo": True,
        "modulo_estoque_ativo": True,
        "sync_google_ativo": True,
        "whatsapp_waha_ativo": True,
        "ativo": True,
    },
]


def seed_planos(apps, schema_editor):
    PlanoAssinatura = apps.get_model("plataforma", "PlanoAssinatura")
    for dados in PLANOS:
        PlanoAssinatura.objects.get_or_create(nome=dados["nome"], defaults=dados)


def remover_planos(apps, schema_editor):
    PlanoAssinatura = apps.get_model("plataforma", "PlanoAssinatura")
    PlanoAssinatura.objects.filter(nome__in=[p["nome"] for p in PLANOS]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("plataforma", "0003_planoassinatura_periodicidade"),
    ]

    operations = [
        migrations.RunPython(seed_planos, remover_planos),
    ]
