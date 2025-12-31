# 🧪 Guia de Testes - SISCR SaaS

## 📋 Visão Geral

O projeto possui testes automatizados para garantir qualidade e prevenir regressões.

## 🚀 Como Executar Testes

### Executar Todos os Testes
```bash
python manage.py test
```

### Executar Testes de um App Específico
```bash
# Testes de autenticação
python manage.py test accounts.tests

# Testes de signup
python manage.py test public.tests

# Testes de APIs do core
python manage.py test core.api.tests
```

### Executar um Teste Específico
```bash
python manage.py test accounts.tests.AuthenticationTests.test_login_success
```

### Com Verbosidade
```bash
python manage.py test --verbosity=2
```

### Manter Banco de Testes (Mais Rápido)
```bash
python manage.py test --keepdb
```

## 📦 Testes Disponíveis

### 1. Testes de Autenticação (`accounts/tests.py`)

#### `AuthenticationTests`
- ✅ `test_login_success` - Login bem-sucedido
- ✅ `test_login_invalid_credentials` - Login com credenciais inválidas
- ✅ `test_login_missing_fields` - Login sem campos obrigatórios
- ✅ `test_refresh_token` - Renovação de token
- ✅ `test_verify_token` - Verificação de token
- ✅ `test_login_nonexistent_domain` - Login com domínio inexistente

### 2. Testes de Signup (`public/tests.py`)

#### `SignupTests`
- ✅ `test_signup_success` - Cadastro bem-sucedido
- ✅ `test_signup_missing_fields` - Cadastro sem campos obrigatórios
- ✅ `test_signup_duplicate_domain` - Cadastro com domínio duplicado
- ✅ `test_signup_invalid_plan` - Cadastro com plano inválido
- ✅ `test_check_domain_available` - Verificação de domínio disponível
- ✅ `test_check_domain_unavailable` - Verificação de domínio não disponível
- ✅ `test_list_plans` - Listagem de planos públicos

### 3. Testes de APIs Core (`core/api/tests.py`)

#### `HealthCheckTests`
- ✅ `test_health_check_success` - Health check funcionando
- ✅ `test_health_check_structure` - Estrutura da resposta
- ✅ `test_health_check_no_auth_required` - Não requer autenticação

#### `APIRootTests`
- ✅ `test_api_root` - Endpoint raiz da API
- ✅ `test_api_root_requires_auth` - Requer autenticação

## 🏗️ Estrutura de Testes

### Setup e Teardown
Cada classe de teste tem um método `setUp()` que:
- Cria dados de teste necessários
- Configura o cliente de API
- Prepara o ambiente para os testes

### Padrões de Teste
- **Nomenclatura**: `test_<funcionalidade>_<cenario>`
- **Assertions**: Usar `assertEqual`, `assertIn`, `assertTrue`, etc.
- **Status Codes**: Verificar status HTTP apropriado
- **Dados**: Verificar estrutura e conteúdo das respostas

## 🔧 Configuração

### Banco de Dados de Testes
O Django cria automaticamente um banco de dados de testes separado:
- Nome: `test_<nome_do_banco>`
- Criado automaticamente antes dos testes
- Destruído após os testes (a menos que use `--keepdb`)

### Multi-Tenancy em Testes
Os testes usam `schema_context` para gerenciar schemas:
```python
with schema_context('public'):
    # Código que roda no schema público
    tenant = Tenant.objects.create(...)

with schema_context(tenant.schema_name):
    # Código que roda no schema do tenant
    empresa = Empresa.objects.create(...)
```

## 📊 Cobertura de Testes

### Atual
- ✅ Autenticação (login, refresh, verify)
- ✅ Signup (criação de tenant)
- ✅ Health check
- ✅ APIs públicas (plans, check-domain)

### Pendente
- ⏳ Testes de modelos (Pessoa, Produto, Servico)
- ⏳ Testes de quotas e limites
- ⏳ Testes de pagamentos
- ⏳ Testes de isolamento multi-tenant
- ⏳ Testes de integração end-to-end

## 🐛 Troubleshooting

### Erro: "Database doesn't exist"
```bash
# Limpar banco de testes e recriar
python manage.py test --keepdb --verbosity=2
```

### Erro: "Schema does not exist"
- Verificar se `setUp()` está criando os schemas corretamente
- Usar `schema_context` para alternar entre schemas

### Testes Lentos
- Usar `--keepdb` para manter banco entre execuções
- Executar apenas testes específicos
- Verificar se há queries N+1

## 📝 Adicionando Novos Testes

### Exemplo de Teste
```python
class MyFeatureTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        # Configuração inicial
    
    def test_my_feature_success(self):
        """Testa funcionalidade X com sucesso"""
        url = '/api/my-endpoint/'
        data = {'field': 'value'}
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('expected_field', response.data)
```

## ✅ Checklist para Novos Testes

- [ ] Teste de sucesso (happy path)
- [ ] Teste de erro (validações)
- [ ] Teste de campos obrigatórios
- [ ] Teste de permissões (se aplicável)
- [ ] Teste de edge cases
- [ ] Documentação do teste

## 🔗 Recursos

- [Django Testing](https://docs.djangoproject.com/en/4.2/topics/testing/)
- [DRF Testing](https://www.django-rest-framework.org/api-guide/testing/)
- [django-tenants Testing](https://django-tenants.readthedocs.io/en/latest/testing.html)

---

**Última atualização**: 2024-12-24

