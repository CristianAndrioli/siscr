# 🌱 Seed de Dados - SISCR

## 📋 Visão Geral

O comando `seed_data` popula o banco de dados com dados de exemplo para facilitar o desenvolvimento e testes.

## 🚀 Como Usar

### Comando Básico

```bash
# Criar tabelas e popular dados
docker-compose exec web python manage.py seed_data --migrate

# Apenas popular dados (se as tabelas já existirem)
docker-compose exec web python manage.py seed_data

# Limpar dados existentes e popular novamente
docker-compose exec web python manage.py seed_data --clear
```

### Criar Tabelas Manualmente (se necessário)

```bash
docker-compose exec web python manage.py create_tables
```

## 📊 Dados Criados

### Pessoas (9 registros)

**Pessoas Físicas - Clientes:**
- João Silva Santos (CPF: 123.456.789-01)
- Maria Oliveira Costa (CPF: 987.654.321-00)
- Carlos Eduardo Pereira (CPF: 111.222.333-44)

**Pessoas Jurídicas - Clientes:**
- Tech Solutions Ltda (CNPJ: 12.345.678/0001-90)
- Comércio Exterior Importadora S.A. (CNPJ: 98.765.432/0001-11)

**Fornecedores:**
- Fornecedora Nacional Ltda (CNPJ: 11.223.344/0001-55)
- Importadora Internacional S.A. (CNPJ: 55.667.788/0001-22)

**Funcionários:**
- Pedro Henrique Alves (Vendedor - 5% comissão)
- Juliana Ferreira (Gerente de Vendas - 3% comissão)

### Produtos (5 registros)

1. **Notebook Dell Inspiron 15**
   - Código: 1001
   - Valor: R$ 3.299,00
   - NCM: 84713012

2. **Mouse Logitech MX Master 3**
   - Código: 1002
   - Valor: R$ 499,00
   - NCM: 84716052

3. **Teclado Mecânico RGB**
   - Código: 1003
   - Valor: R$ 699,00
   - NCM: 84716060

4. **Aço Inox 304 - Chapa**
   - Código: 2001
   - Valor: R$ 120,00/m²
   - NCM: 72191200

5. **Produto Importado - Componente Eletrônico**
   - Código: 2002
   - Valor: R$ 250,00
   - NCM: 85414011
   - Importado (USD, CIF)

### Serviços (5 registros)

1. **Consultoria em Comércio Exterior**
   - Código: 3001
   - Valor: R$ 5.000,00/mês
   - Tipo: Mensal

2. **Despacho Aduaneiro**
   - Código: 3002
   - Valor: R$ 1.500,00
   - Tipo: Avulso

3. **Gestão de Documentação**
   - Código: 3003
   - Valor: R$ 800,00
   - Tipo: Avulso

4. **Análise de Viabilidade de Importação**
   - Código: 3004
   - Valor: R$ 2.500,00
   - Tipo: Por Projeto

5. **Suporte Técnico Especializado**
   - Código: 3005
   - Valor: R$ 3.000,00/mês
   - Tipo: Mensal

## 🔧 Opções do Comando

### `--migrate`
Aplica migrações antes de popular os dados (se necessário).

### `--clear`
Limpa todos os dados existentes antes de popular novamente.

## 📝 Notas

- Os dados são criados usando `bulk_create` para melhor performance
- Se houver erro, o comando tenta criar registro por registro
- Os códigos são fixos (1-31 para pessoas, 1001+ para produtos, 3001+ para serviços)
- Se um registro já existir, será ignorado (não duplica)

## 🐛 Solução de Problemas

### Tabelas não existem

```bash
# Criar tabelas manualmente
docker-compose exec web python manage.py create_tables

# Depois executar o seed
docker-compose exec web python manage.py seed_data
```

### Erro de transação

O comando não usa transações atômicas para evitar problemas com django-tenants. Se houver erro, alguns dados podem ter sido criados mesmo assim.

---

**Última atualização**: 2025-01-XX

