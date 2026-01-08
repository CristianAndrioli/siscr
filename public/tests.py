"""
Testes para endpoints públicos (signup, etc.)
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django_tenants.utils import schema_context
from tenants.models import Tenant, Domain, Empresa
from subscriptions.models import Plan, Subscription
from accounts.models import UserProfile, TenantMembership

User = get_user_model()


class SignupTests(TestCase):
    """Testes para cadastro público de novos clientes"""
    
    def setUp(self):
        """Configuração inicial"""
        self.client = APIClient()
        
        with schema_context('public'):
            # Criar plano básico
            self.plan = Plan.objects.create(
                name='Plano Básico',
                slug='basico',
                price_monthly=99.00,
                max_users=10,
                max_empresas=5,
                max_filiais=10,
                is_active=True
            )
    
    def test_signup_success(self):
        """Testa cadastro bem-sucedido"""
        url = '/api/public/signup/'
        data = {
            'tenant_name': 'Nova Empresa',
            'domain': 'nova-empresa',
            'plan_id': self.plan.id,
            'admin_username': 'admin',
            'admin_email': 'admin@novaempresa.com',
            'admin_password': 'senha123456',
            'admin_first_name': 'Admin',
            'admin_last_name': 'User',
            'empresa_nome': 'Nova Empresa LTDA',
            'empresa_cnpj': '12.345.678/0001-90',
            'empresa_razao_social': 'Nova Empresa LTDA'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('message', response.data)
        self.assertIn('tenant', response.data)
        self.assertIn('user', response.data)
        
        # Verificar se tenant foi criado
        with schema_context('public'):
            tenant = Tenant.objects.get(schema_name='nova_empresa')
            self.assertEqual(tenant.name, 'Nova Empresa')
            self.assertTrue(tenant.is_active)
            
            # Verificar se domínio foi criado
            domain = Domain.objects.get(domain='nova-empresa')
            self.assertEqual(domain.tenant, tenant)
            
            # Verificar se usuário foi criado
            user = User.objects.get(username='admin')
            self.assertEqual(user.email, 'admin@novaempresa.com')
            
            # Verificar se empresa foi criada no schema do tenant
            with schema_context(tenant.schema_name):
                empresa = Empresa.objects.first()
                self.assertIsNotNone(empresa)
                self.assertEqual(empresa.nome, 'Nova Empresa LTDA')
    
    def test_signup_missing_fields(self):
        """Testa cadastro sem campos obrigatórios"""
        url = '/api/public/signup/'
        data = {
            'tenant_name': 'Nova Empresa',
            # Faltando outros campos obrigatórios
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_signup_duplicate_domain(self):
        """Testa cadastro com domínio já existente"""
        # Criar tenant existente
        with schema_context('public'):
            existing_tenant = Tenant.objects.create(
                schema_name='existing',
                name='Existing Tenant',
                is_active=True
            )
            Domain.objects.create(
                domain='existing',
                tenant=existing_tenant,
                is_primary=True
            )
        
        # Tentar cadastrar com mesmo domínio
        url = '/api/public/signup/'
        data = {
            'tenant_name': 'Nova Empresa',
            'domain': 'existing',
            'plan_id': self.plan.id,
            'admin_username': 'admin',
            'admin_email': 'admin@novaempresa.com',
            'admin_password': 'senha123456',
            'empresa_nome': 'Nova Empresa LTDA',
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
        self.assertIn('Domínio já está em uso', response.data['error'])
    
    def test_signup_invalid_plan(self):
        """Testa cadastro com plano inválido"""
        url = '/api/public/signup/'
        data = {
            'tenant_name': 'Nova Empresa',
            'domain': 'nova-empresa',
            'plan_id': 99999,  # Plano inexistente
            'admin_username': 'admin',
            'admin_email': 'admin@novaempresa.com',
            'admin_password': 'senha123456',
            'empresa_nome': 'Nova Empresa LTDA',
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)
    
    def test_check_domain_available(self):
        """Testa verificação de domínio disponível"""
        url = '/api/public/check-domain/'
        data = {'domain': 'novo-dominio'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['available'])
    
    def test_check_domain_unavailable(self):
        """Testa verificação de domínio não disponível"""
        # Criar tenant existente
        with schema_context('public'):
            existing_tenant = Tenant.objects.create(
                schema_name='existing',
                name='Existing Tenant',
                is_active=True
            )
            Domain.objects.create(
                domain='existing',
                tenant=existing_tenant,
                is_primary=True
            )
        
        url = '/api/public/check-domain/'
        data = {'domain': 'existing'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['available'])
    
    def test_list_plans(self):
        """Testa listagem de planos públicos"""
        url = '/api/public/plans/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertGreater(len(response.data), 0)
        self.assertIn('id', response.data[0])
        self.assertIn('name', response.data[0])
        self.assertIn('price_monthly', response.data[0])
