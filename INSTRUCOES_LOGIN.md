# 🔐 Instruções de Login - SISCR

## 📍 URLs da Aplicação

### URLs Principais
- **Admin Django**: http://localhost:8000/admin/
- **Login**: http://localhost:8000/login/
- **Dashboard**: http://localhost:8000/dashboard/
- **API**: http://localhost:8000/api/

## 🔑 Credenciais de Acesso

### Superusuário (Admin)
- **Usuário**: `admin`
- **Senha**: `admin123`

### Acesso ao Admin Django
1. Acesse: http://localhost:8000/admin/
2. Use as credenciais acima
3. Você terá acesso a:
   - Gerenciar Tenants
   - Gerenciar Empresas e Filiais
   - Gerenciar Usuários
   - Gerenciar todos os modelos do sistema

## 🏢 Estrutura Multi-Tenant

### Tenant Atual
- **Nome**: Tenant Teste
- **Schema**: `teste`
- **Domínio**: `localhost`

### Hierarquia
```
Tenant Teste
└── Empresa Teste
    └── Filial Central
```

## 📝 Notas Importantes

1. **Multi-Tenant Ativo**: O sistema está configurado com django-tenants
   - Cada tenant tem seu próprio schema no PostgreSQL
   - Dados completamente isolados por tenant

2. **Domínio**: Atualmente configurado para `localhost`
   - Em produção, cada tenant terá seu próprio subdomínio
   - Exemplo: `tenant1.siscr.com.br`, `tenant2.siscr.com.br`

3. **Admin Django**: Acessível via `/admin/`
   - Permite gerenciar tenants, empresas, filiais
   - Interface completa do Django Admin

4. **API REST**: Disponível em `/api/`
   - Autenticação via JWT
   - Endpoint: `/api/auth/token/`

## 🚀 Próximos Passos

- Criar mais tenants de teste
- Configurar empresas e filiais
- Integrar frontend React
- Implementar autenticação por tenant

---

**Última atualização**: 2025-11-05

