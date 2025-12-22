"""
Comando Django para limpar completamente o banco de dados
Remove todos os dados órfãos que ficaram após excluir tenants
Uso: python manage.py cleanup_database [--confirm]
"""
from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.contrib.auth import get_user_model
from accounts.models import UserProfile, TenantMembership
from tenants.models import Tenant, Domain, Empresa, Filial
from subscriptions.models import Subscription, QuotaUsage
from payments.models import Payment, Invoice, PaymentMethod

User = get_user_model()


class Command(BaseCommand):
    help = 'Limpa completamente o banco de dados, removendo todos os dados órfãos'

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            help='Confirma que você realmente quer limpar o banco de dados',
        )

    def handle(self, *args, **options):
        if not options['confirm']:
            self.stdout.write(self.style.ERROR(
                '⚠️  ATENÇÃO: Este comando irá REMOVER TODOS OS DADOS do banco de dados!'
            ))
            self.stdout.write('')
            self.stdout.write('Para confirmar, execute: python manage.py cleanup_database --confirm')
            return

        self.stdout.write(self.style.WARNING('🧹 Iniciando limpeza completa do banco de dados...'))
        self.stdout.write('')

        try:
            with transaction.atomic():
                # 1. Remover todos os tenants e seus schemas
                self.stdout.write('1. Removendo tenants e schemas...')
                tenants = Tenant.objects.all()
                tenant_count = tenants.count()
                for tenant in tenants:
                    try:
                        schema_name = tenant.schema_name
                        # Remover schema do banco
                        with connection.cursor() as cursor:
                            cursor.execute(
                                "SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s",
                                [schema_name]
                            )
                            if cursor.fetchone():
                                cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')
                        tenant.delete()
                        self.stdout.write(f'   ✅ Schema "{schema_name}" removido')
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'   ❌ Erro ao remover tenant {tenant.name}: {str(e)}'))
                self.stdout.write(f'   ✅ {tenant_count} tenant(s) removido(s)')

                # 2. Remover todos os domínios
                self.stdout.write('2. Removendo domínios...')
                domain_count = Domain.objects.count()
                Domain.objects.all().delete()
                self.stdout.write(f'   ✅ {domain_count} domínio(s) removido(s)')

                # 3. Remover todas as assinaturas e quotas
                self.stdout.write('3. Removendo assinaturas e quotas...')
                subscription_count = Subscription.objects.count()
                quota_count = QuotaUsage.objects.count()
                Subscription.objects.all().delete()
                QuotaUsage.objects.all().delete()
                self.stdout.write(f'   ✅ {subscription_count} assinatura(s) e {quota_count} quota(s) removida(s)')

                # 4. Remover todos os pagamentos, faturas e métodos de pagamento
                self.stdout.write('4. Removendo pagamentos, faturas e métodos de pagamento...')
                with connection.cursor() as cursor:
                    # Remover faturas
                    cursor.execute("SELECT COUNT(*) FROM payments_invoice")
                    invoice_count = cursor.fetchone()[0]
                    cursor.execute("DELETE FROM payments_invoice")
                    
                    # Remover pagamentos
                    cursor.execute("SELECT COUNT(*) FROM payments_payment")
                    payment_count = cursor.fetchone()[0]
                    cursor.execute("DELETE FROM payments_payment")
                    
                    # Remover métodos de pagamento
                    cursor.execute("SELECT COUNT(*) FROM payments_paymentmethod")
                    payment_method_count = cursor.fetchone()[0]
                    cursor.execute("DELETE FROM payments_paymentmethod")
                    
                    # Remover pending signups (se existir)
                    try:
                        cursor.execute("SELECT COUNT(*) FROM public_pendingsignup")
                        pending_count = cursor.fetchone()[0]
                        cursor.execute("DELETE FROM public_pendingsignup")
                        self.stdout.write(f'   ✅ {pending_count} pending signup(s) removido(s)')
                    except Exception:
                        pass
                    
                self.stdout.write(f'   ✅ {invoice_count} fatura(s), {payment_count} pagamento(s) e {payment_method_count} método(s) de pagamento removido(s)')

                # 5. Remover todas as empresas e filiais
                self.stdout.write('5. Removendo empresas e filiais...')
                with connection.cursor() as cursor:
                    cursor.execute("SELECT COUNT(*) FROM tenants_filial")
                    filial_count = cursor.fetchone()[0]
                    cursor.execute("DELETE FROM tenants_filial")
                    
                    cursor.execute("SELECT COUNT(*) FROM tenants_empresa")
                    empresa_count = cursor.fetchone()[0]
                    cursor.execute("DELETE FROM tenants_empresa")
                    
                self.stdout.write(f'   ✅ {empresa_count} empresa(s) e {filial_count} filial(is) removida(s)')

                # 6. Remover todos os memberships
                self.stdout.write('6. Removendo memberships...')
                membership_count = TenantMembership.objects.count()
                TenantMembership.objects.all().delete()
                self.stdout.write(f'   ✅ {membership_count} membership(s) removido(s)')

                # 7. Remover todos os perfis de usuário
                self.stdout.write('7. Removendo perfis de usuário...')
                profile_count = UserProfile.objects.count()
                UserProfile.objects.all().delete()
                self.stdout.write(f'   ✅ {profile_count} perfil(is) de usuário removido(s)')

                # 8. Remover todos os usuários (exceto superusuários, se houver)
                self.stdout.write('8. Removendo usuários...')
                # Verificar se há superusuários
                superuser_count = User.objects.filter(is_superuser=True).count()
                if superuser_count > 0:
                    self.stdout.write(self.style.WARNING(
                        f'   ⚠️  {superuser_count} superusuário(s) encontrado(s). Deseja removê-los também?'
                    ))
                    self.stdout.write('   (Superusuários NÃO serão removidos automaticamente)')
                
                # Remover usuários não-superusuários
                with connection.cursor() as cursor:
                    # Remover permissões e grupos primeiro
                    cursor.execute("""
                        DELETE FROM auth_user_user_permissions 
                        WHERE user_id IN (
                            SELECT id FROM auth_user WHERE is_superuser = FALSE
                        )
                    """)
                    
                    cursor.execute("""
                        DELETE FROM auth_user_groups 
                        WHERE user_id IN (
                            SELECT id FROM auth_user WHERE is_superuser = FALSE
                        )
                    """)
                    
                    # Remover sessões
                    cursor.execute("DELETE FROM django_session")
                    
                    # Contar usuários não-superusuários
                    cursor.execute("SELECT COUNT(*) FROM auth_user WHERE is_superuser = FALSE")
                    user_count = cursor.fetchone()[0]
                    
                    # Remover usuários não-superusuários
                    cursor.execute("DELETE FROM auth_user WHERE is_superuser = FALSE")
                    
                self.stdout.write(f'   ✅ {user_count} usuário(s) não-superusuário(s) removido(s)')
                if superuser_count > 0:
                    self.stdout.write(self.style.WARNING(
                        f'   ⚠️  {superuser_count} superusuário(s) mantido(s)'
                    ))

                self.stdout.write('')
                self.stdout.write(self.style.SUCCESS('=' * 60))
                self.stdout.write(self.style.SUCCESS('✅ Limpeza completa do banco de dados concluída!'))
                self.stdout.write(self.style.SUCCESS('=' * 60))
                self.stdout.write('')
                self.stdout.write('📊 Resumo:')
                self.stdout.write(f'   - {tenant_count} tenant(s) removido(s)')
                self.stdout.write(f'   - {domain_count} domínio(s) removido(s)')
                self.stdout.write(f'   - {subscription_count} assinatura(s) removida(s)')
                self.stdout.write(f'   - {quota_count} quota(s) removida(s)')
                self.stdout.write(f'   - {invoice_count} fatura(s) removida(s)')
                self.stdout.write(f'   - {payment_count} pagamento(s) removido(s)')
                self.stdout.write(f'   - {payment_method_count} método(s) de pagamento removido(s)')
                self.stdout.write(f'   - {empresa_count} empresa(s) removida(s)')
                self.stdout.write(f'   - {filial_count} filial(is) removida(s)')
                self.stdout.write(f'   - {membership_count} membership(s) removido(s)')
                self.stdout.write(f'   - {profile_count} perfil(is) removido(s)')
                self.stdout.write(f'   - {user_count} usuário(s) removido(s)')
                if superuser_count > 0:
                    self.stdout.write(f'   - {superuser_count} superusuário(s) mantido(s)')

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'❌ Erro durante a limpeza: {str(e)}'))
            raise

