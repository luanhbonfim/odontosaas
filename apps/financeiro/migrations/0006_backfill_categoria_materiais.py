from django.db import migrations


def backfill_materiais(apps, schema_editor):
    """Despesas geradas por compra de insumo (têm movimentação de estoque ligada)
    ganham categoria MATERIAIS. O critério NÃO é `fornecedor` — despesa manual
    também pode ter fornecedor."""
    Lancamento = apps.get_model("financeiro", "LancamentoFinanceiro")
    Lancamento.objects.filter(
        tipo="DESPESA", categoria="", movimentacoes_estoque__isnull=False
    ).update(categoria="MATERIAIS")


class Migration(migrations.Migration):

    dependencies = [
        ('financeiro', '0005_lancamentofinanceiro_categoria'),
        ('estoque', '0004_fornecedor_movimentacaoestoque_lancamento_financeiro_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_materiais, migrations.RunPython.noop),
    ]
