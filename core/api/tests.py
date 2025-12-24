"""
Testes para APIs do core
"""
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from django.core.cache import cache
from django.db import connection


class HealthCheckTests(TestCase):
    """Testes para health check endpoint"""
    
    def setUp(self):
        """Configuração inicial"""
        self.client = APIClient()
    
    def test_health_check_success(self):
        """Testa health check quando tudo está funcionando"""
        url = '/api/health/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'healthy')
        self.assertIn('timestamp', response.data)
        self.assertIn('services', response.data)
        self.assertIn('database', response.data['services'])
        self.assertIn('cache', response.data['services'])
        self.assertIn('configuration', response.data['services'])
    
    def test_health_check_structure(self):
        """Testa estrutura da resposta do health check"""
        url = '/api/health/'
        response = self.client.get(url)
        
        self.assertIn('status', response.data)
        self.assertIn('timestamp', response.data)
        self.assertIn('version', response.data)
        self.assertIn('services', response.data)
        
        services = response.data['services']
        self.assertIn('database', services)
        self.assertIn('cache', services)
        self.assertIn('configuration', services)
        
        # Verificar estrutura de cada serviço
        for service_name, service_data in services.items():
            self.assertIn('status', service_data)
            self.assertIn('message', service_data)
    
    def test_health_check_no_auth_required(self):
        """Testa que health check não requer autenticação"""
        url = '/api/health/'
        # Não autenticar o cliente
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class APIRootTests(TestCase):
    """Testes para API root"""
    
    def setUp(self):
        """Configuração inicial"""
        self.client = APIClient()
        # Criar usuário e autenticar
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_api_root(self):
        """Testa endpoint raiz da API"""
        url = '/api/'
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('version', response.data)
        self.assertIn('user', response.data)
        self.assertIn('endpoints', response.data)
    
    def test_api_root_requires_auth(self):
        """Testa que API root requer autenticação"""
        # Criar cliente sem autenticação
        client = APIClient()
        url = '/api/'
        response = client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

