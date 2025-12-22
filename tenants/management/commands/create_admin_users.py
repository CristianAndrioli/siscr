"""
Comando para criar ou atualizar usuários admin para todos os tenants
Uso: python manage.py create_admin_users
"""
from django.core.management.base import BaseCommand
from django_tenants.utils import schema_context
from django.contrib.auth import get_user_model
from accounts.models import UserProfile, TenantMembership
from tenants.models import Tenant

User = get_user_model()


class Command(BaseCommand):
    help = 'Cria ou atualiza usuários admin para todos os tenants'

    def handle(self, *args, **options):
        self.stdout.write("🔐 Criando/atualizando usuários admin para todos os tenants...")
        self.stdout.write("")
        
        tenants = Tenant.objects.all()
        
        if not tenants.exists():
            self.stdout.write(self.style.WARNING("⚠️  Nenhum tenant encontrado!"))
            return
        
        for tenant in tenants:
            self.stdout.write(f"📋 Processando tenant: {tenant.name} ({tenant.schema_name})")
            
            # Criar username do admin
            admin_username = f"admin.{tenant.schema_name}"
            admin_email = f"admin@{tenant.schema_name}.com"
            
            with schema_context('public'):
                # Criar ou obter usuário no schema público
                user_admin, created = User.objects.get_or_create(
                    username=admin_username,
                    defaults={
                        'email': admin_email,
                        'first_name': 'Admin',
                        'last_name': tenant.name,
                    }
                )
                
                if created:
                    user_admin.set_password('senha123')
                    user_admin.save()
                    self.stdout.write(f"  ✅ Usuário criado: {admin_username}")
                else:
                    self.stdout.write(f"  ℹ️  Usuário já existe: {admin_username}")
                
                # Criar ou atualizar perfil
                profile_admin, _ = UserProfile.objects.get_or_create(
                    user=user_admin,
                    defaults={
                        'current_tenant': tenant,
                    }
                )
                
                if not profile_admin.current_tenant:
                    profile_admin.current_tenant = tenant
                    profile_admin.save()
                
                # Criar ou atualizar membership como admin
                membership_admin, created = TenantMembership.objects.get_or_create(
                    user=user_admin,
                    tenant=tenant,
                    defaults={
                        'role': 'admin',
                        'is_active': True,
                    }
                )
                
                # Garantir que seja admin mesmo se já existir
                if membership_admin.role != 'admin':
                    membership_admin.role = 'admin'
                    membership_admin.is_active = True
                    membership_admin.save()
                    self.stdout.write(f"  ✅ Membership atualizado para admin")
                elif created:
                    self.stdout.write(f"  ✅ Membership criado como admin")
                else:
                    self.stdout.write(f"  ℹ️  Membership já existe como admin")
            
            # Criar no schema do tenant também
            with schema_context(tenant.schema_name):
                user_admin_tenant, created = User.objects.get_or_create(
                    username=admin_username,
                    defaults={
                        'email': admin_email,
                        'first_name': 'Admin',
                        'last_name': tenant.name,
                    }
                )
                
                if not user_admin_tenant.has_usable_password():
                    user_admin_tenant.set_password('senha123')
                    user_admin_tenant.save()
                
                if created:
                    self.stdout.write(f"  ✅ Usuário criado no schema do tenant")
                else:
                    self.stdout.write(f"  ℹ️  Usuário já existe no schema do tenant")
            
            self.stdout.write("")
        
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write(self.style.SUCCESS("✅ Usuários admin criados/atualizados com sucesso!"))
        self.stdout.write(self.style.SUCCESS("=" * 60))
        self.stdout.write("")
        self.stdout.write("📋 Resumo dos usuários admin criados:")
        self.stdout.write("")
        
        for tenant in tenants:
            admin_username = f"admin.{tenant.schema_name}"
            self.stdout.write(f"  • {tenant.name}: {admin_username} (senha: senha123)")
        
        self.stdout.write("")

