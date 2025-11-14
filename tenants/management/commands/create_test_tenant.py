"""
Comando Django para criar tenant de teste
"""
from django.core.management.base import BaseCommand
from tenants.models import Tenant, Domain, Empresa
from django.contrib.auth import get_user_model
from accounts.models import UserProfile, TenantMembership
from django_tenants.utils import schema_context

User = get_user_model()


class Command(BaseCommand):
    help = 'Cria um tenant de teste para desenvolvimento'

    def handle(self, *args, **options):
        # Verificar se já existe
        if Tenant.objects.filter(schema_name='teste_tenant').exists():
            self.stdout.write(self.style.WARNING('Tenant de teste já existe!'))
            return

        # Criar tenant
        tenant = Tenant.objects.create(
            name='Teste Tenant',
            schema_name='teste_tenant',
            is_active=True
        )
        self.stdout.write(self.style.SUCCESS(f'✅ Tenant criado: {tenant.name} ({tenant.schema_name})'))

        # Criar domínio
        domain = Domain.objects.create(
            domain='teste-tenant.localhost',
            tenant=tenant,
            is_primary=True
        )
        self.stdout.write(self.style.SUCCESS(f'✅ Domínio criado: {domain.domain}'))

        # Criar usuário no schema público
        user_public, created = User.objects.get_or_create(
            username='teste_user',
            defaults={
                'email': 'teste@teste.com',
            }
        )
        if created:
            user_public.set_password('senha123')
            user_public.save()
            self.stdout.write(self.style.SUCCESS(f'✅ Usuário público criado: {user_public.username}'))
        else:
            self.stdout.write(self.style.WARNING(f'⚠️  Usuário público já existe: {user_public.username}'))

        # Criar perfil
        profile, _ = UserProfile.objects.get_or_create(
            user=user_public,
            defaults={'current_tenant': tenant}
        )
        if not profile.current_tenant:
            profile.current_tenant = tenant
            profile.save()

        # Criar membership
        membership, created = TenantMembership.objects.get_or_create(
            user=user_public,
            tenant=tenant,
            defaults={
                'role': 'admin',
                'is_active': True
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'✅ Membership criado'))
        else:
            self.stdout.write(self.style.WARNING(f'⚠️  Membership já existe'))

        # Migrar schema do tenant
        from django.core.management import call_command
        self.stdout.write('🔄 Aplicando migrações no schema do tenant...')
        call_command('migrate_schemas', schema_name=tenant.schema_name)

        # Criar usuário e empresa no schema do tenant
        with schema_context(tenant.schema_name):
            user_tenant, created = User.objects.get_or_create(
                username='teste_user',
                defaults={
                    'email': 'teste@teste.com',
                }
            )
            if created:
                user_tenant.set_password('senha123')
                user_tenant.save()
                self.stdout.write(self.style.SUCCESS(f'✅ Usuário no tenant criado: {user_tenant.username}'))
            else:
                self.stdout.write(self.style.WARNING(f'⚠️  Usuário no tenant já existe: {user_tenant.username}'))

            empresa, created = Empresa.objects.get_or_create(
                tenant=tenant,
                cnpj='12345678000190',
                defaults={
                    'nome': 'Empresa Teste',
                    'razao_social': 'Empresa Teste LTDA',
                    'is_active': True
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✅ Empresa criada: {empresa.nome}'))
            else:
                self.stdout.write(self.style.WARNING(f'⚠️  Empresa já existe: {empresa.nome}'))

        self.stdout.write(self.style.SUCCESS('\n🎉 Tenant de teste criado com sucesso!'))
        self.stdout.write(f'\n📝 Credenciais de teste:')
        self.stdout.write(f'   Username: teste_user')
        self.stdout.write(f'   Password: senha123')
        self.stdout.write(f'   URL: http://teste-tenant.localhost:8000/api/auth/login/')


