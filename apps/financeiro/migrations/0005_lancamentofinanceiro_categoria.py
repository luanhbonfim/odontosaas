from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('financeiro', '0004_lancamentofinanceiro_numero_parcela_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='lancamentofinanceiro',
            name='categoria',
            field=models.CharField(
                blank=True,
                choices=[
                    ('MATERIAIS', 'Materiais'),
                    ('SALARIOS', 'Salários'),
                    ('ALUGUEL', 'Aluguel'),
                    ('LABORATORIO', 'Laboratório'),
                    ('OUTRAS', 'Outras'),
                ],
                max_length=20,
            ),
        ),
    ]
