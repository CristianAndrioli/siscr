# Generated manually to add created_at and updated_at fields to Tenant model
# Migration segura que verifica se os campos já existem antes de adicionar

from django.db import migrations, models, connection


def add_fields_if_not_exist(apps, schema_editor):
    """Adiciona campos apenas se eles não existirem"""
    with connection.cursor() as cursor:
        # Verificar se created_at já existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='tenants_tenant' AND column_name='created_at'
        """)
        created_at_exists = cursor.fetchone() is not None
        
        # Verificar se updated_at já existe
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='tenants_tenant' AND column_name='updated_at'
        """)
        updated_at_exists = cursor.fetchone() is not None
        
        # Adicionar created_at se não existir
        if not created_at_exists:
            cursor.execute("""
                ALTER TABLE tenants_tenant 
                ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            """)
        
        # Adicionar updated_at se não existir
        if not updated_at_exists:
            cursor.execute("""
                ALTER TABLE tenants_tenant 
                ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
            """)


def reverse_add_fields(apps, schema_editor):
    """Não faz nada no rollback para evitar perda de dados"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('tenants', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(
            add_fields_if_not_exist,
            reverse_add_fields,
        ),
        # Atualizar apenas o estado do Django (não modifica o banco novamente)
        migrations.SeparateDatabaseAndState(
            database_operations=[],  # Não fazer nada no banco, já foi feito no RunPython
            state_operations=[
                migrations.AddField(
                    model_name='tenant',
                    name='created_at',
                    field=models.DateTimeField(
                        auto_now_add=True,
                        help_text='Data e hora em que o registro foi criado',
                        verbose_name='Data de Criação',
                        null=True,
                        blank=True,
                    ),
                ),
                migrations.AddField(
                    model_name='tenant',
                    name='updated_at',
                    field=models.DateTimeField(
                        auto_now=True,
                        help_text='Data e hora da última modificação do registro',
                        verbose_name='Data de Atualização',
                        null=True,
                        blank=True,
                    ),
                ),
            ],
        ),
    ]

