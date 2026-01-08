# 🌱 Seed de Múltiplos Tenants com Dados Realistas

## 📋 Descrição

Script para criar 3 tenants completos com dados realistas brasileiros:

1. **Comércio Simples**: 1 empresa, 1 filial
2. **Grupo Expansão**: 1 empresa, 2 filiais
3. **Holding Diversificada**: 2 empresas, cada uma com 2 filiais

## 🎯 O que é criado

Para cada tenant:

### Estrutura
- ✅ Tenant com schema próprio
- ✅ Domínio configurado
- ✅ Assinatura ativa
- ✅ Empresas e filiais conforme configuração

### Dados
- ✅ **Pessoas**: 
  - 3 clientes (PJ) por empresa
  - 2 fornecedores (PJ) por empresa
  - 2 funcionários (PF) por filial
- ✅ **Produtos**: 5 produtos por empresa
- ✅ **Serviços**: 3 serviços por empresa
- ✅ **Contas a Receber**: 10 contas vinculadas a clientes
- ✅ **Contas a Pagar**: 8 contas vinculadas a fornecedores
- ✅ **Usuários**: 2 usuários por filial (total de 2, 4 ou 8 usuários dependendo do tenant)

## 🚀 Como usar

### Pré-requisitos
- Docker rodando
- Containers iniciados
- Migrações aplicadas no schema público

### Executar

```bash
# Via Docker
docker-compose exec web python seed_multiple_tenants.py

# Ou diretamente (se tiver ambiente configurado)
python seed_multiple_tenants.py
```

## 📊 Estrutura dos Tenants

### 1. Comércio Simples
- **Schema**: `comercio_simples`
- **Empresa**: Comércio Simples LTDA
- **Filial**: Matriz
- **Usuários**: 2
- **Total de pessoas**: ~7 (3 clientes + 2 fornecedores + 2 funcionários)

### 2. Grupo Expansão
- **Schema**: `grupo_expansao`
- **Empresa**: Grupo Expansão LTDA
- **Filiais**: Matriz - Centro, Filial Norte
- **Usuários**: 4 (2 por filial)
- **Total de pessoas**: ~9 (3 clientes + 2 fornecedores + 4 funcionários)

### 3. Holding Diversificada
- **Schema**: `holding_diversificada`
- **Empresas**:
  - Tech Solutions Brasil (2 filiais)
  - Comércio & Serviços Premium (2 filiais)
- **Usuários**: 8 (2 por filial)
- **Total de pessoas**: ~18 (6 clientes + 4 fornecedores + 8 funcionários)

## 🔐 Credenciais

**Senha padrão para todos os usuários**: `senha123`

**Formato de username**: `nome.sobrenome.codigo_filial`

Exemplos:
- `joao.silva.001`
- `maria.santos.002`

## 📝 Dados Gerados

### Pessoas
- Nomes brasileiros realistas
- CPF/CNPJ formatados (sem validação real)
- Endereços em cidades brasileiras
- Emails e telefones formatados

### Produtos
- Nomes de produtos de TI realistas
- Preços de custo e venda
- Códigos NCM válidos
- Informações fiscais completas

### Serviços
- Serviços de consultoria e TI
- Valores baseados no mercado
- Tipos de contrato variados

### Contas
- Contas a receber vinculadas a clientes
- Contas a pagar vinculadas a fornecedores
- Valores variados
- Status variados (Pendente, Parcial, Pago)

## 🌐 Acessos

Após criar os tenants, você pode acessar:

- **Comércio Simples**: http://comercio_simples.localhost:8000
- **Grupo Expansão**: http://grupo_expansao.localhost:8000
- **Holding Diversificada**: http://holding_diversificada.localhost:8000

## ⚠️ Observações

1. **Tenants existentes**: Se um tenant já existir, o script pula a criação mas continua com os dados
2. **Usuários duplicados**: O script usa `get_or_create` para evitar duplicatas
3. **Dados aleatórios**: Os dados são gerados aleatoriamente, então cada execução pode gerar dados diferentes
4. **Schema público**: Usuários, perfis e memberships são criados no schema público

## 🔄 Limpar e Recriar

Para limpar e recriar tudo:

```bash
# Limpar tenants (cuidado!)
docker-compose exec web python manage.py shell
>>> from tenants.models import Tenant
>>> Tenant.objects.filter(schema_name__in=['comercio_simples', 'grupo_expansao', 'holding_diversificada']).delete()

# Depois executar o script novamente
docker-compose exec web python seed_multiple_tenants.py
```

## 📈 Estatísticas Esperadas

Após executar o script:

- **3 tenants** criados
- **4 empresas** criadas
- **7 filiais** criadas
- **~34 pessoas** criadas
- **~20 produtos** criados
- **~12 serviços** criados
- **~30 contas** criadas (receber + pagar)
- **14 usuários** criados

