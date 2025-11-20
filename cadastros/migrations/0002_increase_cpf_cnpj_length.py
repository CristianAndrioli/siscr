# Generated manually to increase cpf_cnpj field length

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cadastros', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='pessoa',
            name='cpf_cnpj',
            field=models.CharField(max_length=20, unique=True, verbose_name='CPF/CNPJ'),
        ),
    ]

