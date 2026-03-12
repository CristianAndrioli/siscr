"""
Comando para popular o banco de dados com dados de exemplo de assinaturas
Uso: python manage.py seed_subscriptions [--clear]
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import timedelta
from decimal import Decimal
from subscriptions.models import Plan, Feature, Subscription, QuotaUsage
from tenants.models import Tenant

User = get_user_model()


class Command(BaseCommand):
    help = 'Popula o banco de dados com planos, funcionalidades e assinaturas de exemplo'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Limpa os dados existentes antes de popular',
        )

    def handle(self, *args, **options):
        clear = options['clear']
        
        if clear:
            self.stdout.write(self.style.WARNING('Limpando dados existentes...'))
            try:
                QuotaUsage.objects.all().delete()
                Subscription.objects.all().delete()
                Plan.objects.all().delete()
                Feature.objects.all().delete()
                self.stdout.write(self.style.SUCCESS('Dados limpos com sucesso!'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Aviso ao limpar: {e}'))

        self.stdout.write('Criando funcionalidades...')
        features = self._create_features()
        
        self.stdout.write('Criando planos...')
        plans = self._create_plans(features)
        
        self.stdout.write('Criando assinaturas para tenants existentes...')
        self._create_subscriptions(plans)
        
        # Criar superusuário se não existir
        self.stdout.write('Verificando superusuário...')
        self._create_superuser()
        
        self.stdout.write(self.style.SUCCESS('\n✅ Seed de assinaturas concluído com sucesso!'))
        self.stdout.write(f'  - {Feature.objects.count()} funcionalidades criadas')
        self.stdout.write(f'  - {Plan.objects.count()} planos criados')
        self.stdout.write(f'  - {Subscription.objects.count()} assinaturas criadas')
        self.stdout.write(f'  - {QuotaUsage.objects.count()} quotas de uso criadas')

    def _create_features(self):
        """Cria funcionalidades de exemplo"""
        features_data = [
            {
                'name': 'Cadastro de Pessoas',
                'description': 'Gerenciamento completo de clientes, fornecedores e funcionários',
                'icon': 'users',
            },
            {
                'name': 'Cadastro de Produtos',
                'description': 'Controle de produtos com NCM, códigos e valores',
                'icon': 'box',
            },
            {
                'name': 'Cadastro de Serviços',
                'description': 'Gestão de serviços e consultorias',
                'icon': 'briefcase',
            },
            {
                'name': 'Faturamento',
                'description': 'Emissão de notas fiscais e cotações',
                'icon': 'file-invoice',
            },
            {
                'name': 'Financeiro',
                'description': 'Contas a receber e a pagar',
                'icon': 'money-bill',
            },
            {
                'name': 'Serviços Logísticos',
                'description': 'Gestão completa de importação e exportação',
                'icon': 'truck',
            },
            {
                'name': 'Relatórios Avançados',
                'description': 'Relatórios personalizados e exportação de dados',
                'icon': 'chart-bar',
            },
            {
                'name': 'API Access',
                'description': 'Acesso à API REST para integrações',
                'icon': 'plug',
            },
            {
                'name': 'Suporte Prioritário',
                'description': 'Suporte técnico com resposta em até 2 horas',
                'icon': 'headset',
            },
            {
                'name': 'Backup Automatizado',
                'description': 'Backup diário automático dos dados',
                'icon': 'database',
            },
        ]
        
        features = []
        for data in features_data:
            feature, created = Feature.objects.get_or_create(
                name=data['name'],
                defaults=data
            )
            features.append(feature)
            if created:
                self.stdout.write(f'  ✓ Funcionalidade criada: {feature.name}')
        
        return features

    def _create_plans(self, features):
        """Cria planos de exemplo"""
        plans_data = [
            {
                'name': 'Básico',
                'slug': 'basico',
                'description': 'Ideal para pequenas empresas que estão começando',
                'price_monthly': Decimal('99.00'),
                'price_yearly': Decimal('990.00'),
                'max_users': 3,
                'max_empresas': 1,
                'max_filiais': 2,
                'max_storage_gb': 5,
                'is_trial': False,
                'trial_days': 0,
                'display_order': 1,
                'features': ['Cadastro de Pessoas', 'Cadastro de Produtos', 'Faturamento', 'Financeiro'],
            },
            {
                'name': 'Pro',
                'slug': 'pro',
                'description': 'Para empresas em crescimento que precisam de mais recursos',
                'price_monthly': Decimal('199.00'),
                'price_yearly': Decimal('1990.00'),
                'max_users': 10,
                'max_empresas': 3,
                'max_filiais': 10,
                'max_storage_gb': 20,
                'is_trial': False,
                'trial_days': 0,
                'display_order': 2,
                'features': [
                    'Cadastro de Pessoas', 'Cadastro de Produtos', 'Cadastro de Serviços',
                    'Faturamento', 'Financeiro', 'Serviços Logísticos', 'Relatórios Avançados',
                ],
            },
            {
                'name': 'Enterprise',
                'slug': 'enterprise',
                'description': 'Solução completa para grandes empresas',
                'price_monthly': Decimal('499.00'),
                'price_yearly': Decimal('4990.00'),
                'max_users': 100,
                'max_empresas': 10,
                'max_filiais': 50,
                'max_storage_gb': 100,
                'is_trial': False,
                'trial_days': 0,
                'display_order': 3,
                'features': [
                    'Cadastro de Pessoas', 'Cadastro de Produtos', 'Cadastro de Serviços',
                    'Faturamento', 'Financeiro', 'Serviços Logísticos', 'Relatórios Avançados',
                    'API Access', 'Suporte Prioritário', 'Backup Automatizado',
                ],
            },
            {
                'name': 'Trial',
                'slug': 'trial',
                'description': 'Plano de teste gratuito por 14 dias',
                'price_monthly': Decimal('0.00'),
                'price_yearly': Decimal('0.00'),
                'max_users': 2,
                'max_empresas': 1,
                'max_filiais': 1,
                'max_storage_gb': 1,
                'is_trial': True,
                'trial_days': 14,
                'display_order': 0,
                'features': ['Cadastro de Pessoas', 'Cadastro de Produtos', 'Faturamento'],
            },
        ]
        
        plans = []
        for data in plans_data:
            features_list = data.pop('features', [])
            plan, created = Plan.objects.get_or_create(
                slug=data['slug'],
                defaults=data
            )
            
            # Adicionar funcionalidades
            for feature_name in features_list:
                feature = next((f for f in features if f.name == feature_name), None)
                if feature:
                    plan.features.add(feature)
            
            plans.append(plan)
            if created:
                self.stdout.write(f'  ✓ Plano criado: {plan.name} (R$ {plan.price_monthly}/mês)')
        
        return plans

    def _create_subscriptions(self, plans):
        """Cria assinaturas para tenants existentes"""
        tenants = Tenant.objects.all()
        
        if not tenants.exists():
            self.stdout.write(self.style.WARNING('  ⚠ Nenhum tenant encontrado. Crie tenants primeiro.'))
            return
        
        # Distribuir planos entre tenants
        plan_basico = next((p for p in plans if p.slug == 'basico'), None)
        plan_pro = next((p for p in plans if p.slug == 'pro'), None)
        plan_enterprise = next((p for p in plans if p.slug == 'enterprise'), None)
        plan_trial = next((p for p in plans if p.slug == 'trial'), None)
        
        for index, tenant in enumerate(tenants):
            # Verificar se já tem assinatura
            if hasattr(tenant, 'subscription'):
                self.stdout.write(f'  ⚠ Tenant {tenant.name} já possui assinatura. Pulando...')
                continue
            
            # Distribuir planos: primeiro trial, depois básico, pro, enterprise
            if index == 0 and plan_trial:
                plan = plan_trial
                status = 'trial'
                days = plan.trial_days
            elif index % 3 == 0 and plan_enterprise:
                plan = plan_enterprise
                status = 'active'
                days = 30
            elif index % 2 == 0 and plan_pro:
                plan = plan_pro
                status = 'active'
                days = 30
            else:
                plan = plan_basico
                status = 'active'
                days = 30
            
            if not plan:
                continue
            
            # Criar assinatura
            period_start = timezone.now()
            period_end = period_start + timedelta(days=days)
            
            subscription = Subscription.objects.create(
                tenant=tenant,
                plan=plan,
                status=status,
                billing_cycle='monthly',
                current_period_start=period_start,
                current_period_end=period_end,
            )
            
            # Criar quota usage (se não existir)
            QuotaUsage.objects.get_or_create(tenant=tenant)
            
            self.stdout.write(
                f'  ✓ Assinatura criada: {tenant.name} -> {plan.name} '
                f'({status}, expira em {days} dias)'
            )
    
    def _create_superuser(self):
        """Cria um superusuário se não existir"""
        username = 'admin'
        email = 'admin@siscr.com'
        password = 'admin123'
        
        if User.objects.filter(username=username).exists():
            self.stdout.write(f'  ℹ️  Superusuário {username} já existe')
            return
        
        try:
            User.objects.create_superuser(
                username=username,
                email=email,
                password=password,
                first_name='Admin',
                last_name='SISCR',
            )
            self.stdout.write(self.style.SUCCESS(f'  ✅ Superusuário criado: {username} / {password}'))
            self.stdout.write(self.style.WARNING('  ⚠️  IMPORTANTE: Altere a senha do superusuário em produção!'))
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  ⚠️  Erro ao criar superusuário: {e}'))

