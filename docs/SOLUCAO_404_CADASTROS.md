# 🔧 Solução para Erro 404 em /api/cadastros/pessoas/

## ❌ Problema

Ao acessar `http://localhost:5173/cadastros/pessoas`, ocorre erro 404:
```
GET http://localhost:8000/api/cadastros/produtos/?page=1&search=&page_size=20 404 (Not Found)
```

## 🔍 Causa

O sistema usa **django-tenants** para isolamento multi-tenant. As rotas de cadastros (`/api/cadastros/`) estão disponíveis apenas no **schema do tenant**, não no schema público.

Quando você acessa `http://localhost:8000` diretamente, o Django identifica como **schema público** e usa `public_urls.py`, que não tem as rotas de cadastros.

## ✅ Soluções

### Solução 1: Criar Tenant com Domínio `localhost` (Recomendado para Desenvolvimento)

1. **Acesse o Django Admin:**
   ```
   http://localhost:8000/admin/
   ```

2. **Crie um Tenant:**
   - Vá em **Tenants** → **Add Tenant**
   - **Name**: `Desenvolvimento`
   - **Schema name**: `dev` (ou qualquer nome)
   - **Is active**: ✅
   - Salve

3. **Crie um Domínio para o Tenant:**
   - Vá em **Domains** → **Add Domain**
   - **Domain**: `localhost` (sem porta, sem http)
   - **Tenant**: Selecione o tenant criado
   - **Is primary**: ✅
   - Salve

4. **Migre o schema do tenant:**
   ```bash
   python manage.py migrate_schemas --schema=dev
   ```

5. **Agora acesse:**
   ```
   http://localhost:8000/api/cadastros/pessoas/
   ```
   Deve funcionar! ✅

### Solução 2: Usar Subdomínio (Alternativa)

1. **Criar tenant com subdomínio:**
   - **Domain**: `teste-tenant.localhost`

2. **Adicionar ao hosts do Windows:**
   - Abra como administrador: `C:\Windows\System32\drivers\etc\hosts`
   - Adicione a linha:
     ```
     127.0.0.1 teste-tenant.localhost
     ```

3. **Configurar variável de ambiente no frontend:**
   - Crie `.env` na pasta `frontend/`:
     ```
     VITE_DEV_TENANT_DOMAIN=teste-tenant.localhost
     ```

4. **Acessar:**
   ```
   http://teste-tenant.localhost:8000/api/cadastros/pessoas/
   ```

### Solução 3: Usar Script de Criação Automática

Execute o script de criação de tenant:

```bash
python create_test_tenant.py
```

Ou use o comando Django:

```bash
python manage.py create_test_tenant
```

Isso criará:
- Tenant: `Teste Tenant` (schema: `teste_tenant`)
- Domínio: `teste-tenant.localhost`
- Usuário de teste

## 🧪 Verificar se Funcionou

1. **Teste direto no navegador:**
   ```
   http://localhost:8000/api/cadastros/pessoas/
   ```
   Deve retornar JSON (mesmo que vazio), não 404.

2. **Teste no frontend:**
   ```
   http://localhost:5173/cadastros/pessoas
   ```
   Deve carregar os dados sem erro.

## 📝 Notas Importantes

- **Em desenvolvimento**: Use `localhost` como domínio do tenant para facilitar
- **Em produção**: Cada tenant terá seu próprio subdomínio (ex: `cliente1.siscr.com.br`)
- **Schema público**: Apenas para signup, planos, etc. (não tem cadastros)
- **Schema tenant**: Tem todas as funcionalidades (cadastros, financeiro, etc.)

## 🔄 Mudanças Feitas no Código

1. **`frontend/src/services/api.ts`**: 
   - Agora detecta o domínio do tenant do localStorage
   - Usa domínio padrão de desenvolvimento se não houver tenant

2. **`frontend/vite.config.ts`**:
   - Proxy configurado para manter o Host correto em subdomínios

3. **Logs de debug adicionados**:
   - `frontend/src/services/cadastros/pessoas.ts`
   - `frontend/src/services/cadastros/produtos.ts`
   - `frontend/src/hooks/useCrud.ts`

## ⚠️ Se Ainda Não Funcionar

1. Verifique se o tenant está ativo no Django Admin
2. Verifique se o domínio está correto e marcado como primary
3. Verifique se as migrations foram aplicadas no schema do tenant
4. Verifique o console do navegador para ver qual URL está sendo chamada
5. Verifique os logs do Django para ver qual URLconf está sendo usado

