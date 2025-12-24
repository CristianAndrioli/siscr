"""
Testes para autenticação e contas
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from django_tenants.utils import schema_context
from tenants.models import Tenant, Domain
from accounts.models import UserProfile, TenantMembership
from subscriptions.models import Plan

User = get_user_model()


class AuthenticationTests(TestCase):
    """Testes de autenticação"""
    
    def setUp(self):
        """Configuração inicial para cada teste"""
        self.client = APIClient()
        
        # Criar tenant de teste
        with schema_context('public'):
            self.tenant = Tenant.objects.create(
                schema_name='test_tenant',
                name='Tenant de Teste',
                is_active=True
            )
            Domain.objects.create(
                domain='test.localhost',
                tenant=self.tenant,
                is_primary=True
            )
            
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
            
            # Criar usuário de teste
            self.user = User.objects.create_user(
                username='testuser',
                email='test@example.com',
                password='testpass123',
                first_name='Test',
                last_name='User'
            )
            
            # Criar perfil e membership
            profile = UserProfile.objects.create(user=self.user)
            TenantMembership.objects.create(
                user=self.user,
                tenant=self.tenant,
                is_active=True,
                is_tenant_admin=True
            )
            profile.current_tenant = self.tenant
            profile.save()
    
    def test_login_success(self):
        """Testa login bem-sucedido"""
        url = '/api/auth/login/'
        data = {
            'username': 'testuser',
            'password': 'testpass123',
            'domain': 'test.localhost'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
    
    def test_login_invalid_credentials(self):
        """Testa login com credenciais inválidas"""
        url = '/api/auth/login/'
        data = {
            'username': 'testuser',
            'password': 'wrongpassword',
            'domain': 'test.localhost'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn('error', response.data)
    
    def test_login_missing_fields(self):
        """Testa login sem campos obrigatórios"""
        url = '/api/auth/login/'
        data = {'username': 'testuser'}  # Sem password
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
    
    def test_refresh_token(self):
        """Testa renovação de token"""
        # Primeiro fazer login
        login_url = '/api/auth/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123',
            'domain': 'test.localhost'
        }
        login_response = self.client.post(login_url, login_data, format='json')
        refresh_token = login_response.data['refresh']
        
        # Agora testar refresh
        refresh_url = '/api/auth/token/refresh/'
        refresh_data = {'refresh': refresh_token}
        response = self.client.post(refresh_url, refresh_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
    
    def test_verify_token(self):
        """Testa verificação de token"""
        # Primeiro fazer login
        login_url = '/api/auth/login/'
        login_data = {
            'username': 'testuser',
            'password': 'testpass123',
            'domain': 'test.localhost'
        }
        login_response = self.client.post(login_url, login_data, format='json')
        access_token = login_response.data['access']
        
        # Verificar token
        verify_url = '/api/auth/token/verify/'
        verify_data = {'token': access_token}
        response = self.client.post(verify_url, verify_data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_login_nonexistent_domain(self):
        """Testa login com domínio inexistente"""
        url = '/api/auth/login/'
        data = {
            'username': 'testuser',
            'password': 'testpass123',
            'domain': 'nonexistent.localhost'
        }
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn('error', response.data)
