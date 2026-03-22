/**
 * Schema do banco COMPARTILHADO (DB_SHARED)
 *
 * Contém: tenants, planos, assinaturas, usuários globais,
 * empresas, filiais, e todas as tabelas do ERP (por tenant_id).
 *
 * Arquitetura: UM único D1 por conta Cloudflare.
 * Isolamento: por tenant_id em cada linha.
 *
 * Nota: usamos SQL puro nas migrations (ver migrations/shared/)
 * O Drizzle aqui serve como referência de schema e para type safety.
 */

import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

// ─── Planos ──────────────────────────────────────────────────────
export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  precoMensal: real('preco_mensal').notNull().default(0),
  precoAnual: real('preco_anual').notNull().default(0),
  maxEmpresas: integer('max_empresas').notNull().default(1),
  maxFiliais: integer('max_filiais').notNull().default(3),
  maxUsuarios: integer('max_usuarios').notNull().default(5),
  features: text('features'), // JSON array de features
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  stripePriceIdMensal: text('stripe_price_id_mensal'),
  stripePriceIdAnual: text('stripe_price_id_anual'),
  createdAt: text('created_at').notNull(),
})

// ─── Tenants (empresas contratantes do SaaS) ─────────────────────
export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nome: text('nome').notNull(),
  planId: text('plan_id').references(() => plans.id),
  status: text('status').notNull().default('active'), // active | suspended | cancelled
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionExpiresAt: text('subscription_expires_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  index('idx_tenants_slug').on(t.slug),
  index('idx_tenants_status').on(t.status),
])

// ─── Usuários ─────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  nome: text('nome').notNull(),
  role: text('role').notNull().default('user'), // admin | manager | user | readonly
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  uniqueIndex('idx_users_email_tenant').on(t.email, t.tenantId),
  index('idx_users_tenant').on(t.tenantId),
])

// ─── Empresas (CNPJs do grupo do tenant) ─────────────────────────
export const empresas = sqliteTable('empresas', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  razaoSocial: text('razao_social').notNull(),
  nomeFantasia: text('nome_fantasia'),
  cnpj: text('cnpj').notNull(),
  inscricaoEstadual: text('inscricao_estadual'),
  email: text('email'),
  telefone: text('telefone'),
  logradouro: text('logradouro'),
  numero: text('numero'),
  complemento: text('complemento'),
  bairro: text('bairro'),
  cidade: text('cidade'),
  uf: text('uf'),
  cep: text('cep'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  index('idx_empresas_tenant').on(t.tenantId),
  uniqueIndex('idx_empresas_cnpj_tenant').on(t.cnpj, t.tenantId),
])

// ─── Filiais ──────────────────────────────────────────────────────
export const filiais = sqliteTable('filiais', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  empresaId: text('empresa_id').notNull().references(() => empresas.id),
  nome: text('nome').notNull(),
  cnpj: text('cnpj'), // opcional — filial pode ter CNPJ próprio
  uf: text('uf'),
  cidade: text('cidade'),
  logradouro: text('logradouro'),
  numero: text('numero'),
  bairro: text('bairro'),
  cep: text('cep'),
  ativa: integer('ativa', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_filiais_tenant').on(t.tenantId),
  index('idx_filiais_empresa').on(t.empresaId),
])

// ─── Permissões de usuário por empresa/filial ─────────────────────
export const userPermissions = sqliteTable('user_permissions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id),
  empresaId: text('empresa_id').references(() => empresas.id),
  filialId: text('filial_id').references(() => filiais.id), // null = acesso a todas as filiais da empresa
  role: text('role').notNull().default('user'),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_perms_user').on(t.userId),
  index('idx_perms_tenant').on(t.tenantId),
])

// ─── Cadastros ────────────────────────────────────────────────────
export const pessoas = sqliteTable('pessoas', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull().references(() => empresas.id),
  filialId: text('filial_id').references(() => filiais.id),
  tipo: text('tipo').notNull(), // PF | PJ
  tipoCadastro: text('tipo_cadastro').notNull(), // cliente | fornecedor | funcionario | transportadora
  nome: text('nome').notNull(),
  cpfCnpj: text('cpf_cnpj').notNull(),
  email: text('email'),
  telefone: text('telefone'),
  logradouro: text('logradouro'),
  numero: text('numero'),
  bairro: text('bairro'),
  cidade: text('cidade'),
  uf: text('uf'),
  cep: text('cep'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  index('idx_pessoas_tenant').on(t.tenantId),
  index('idx_pessoas_empresa').on(t.empresaId),
  index('idx_pessoas_tipo').on(t.tipoCadastro),
])

export const produtos = sqliteTable('produtos', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull().references(() => empresas.id),
  codigo: text('codigo').notNull(),
  descricao: text('descricao').notNull(),
  unidade: text('unidade').notNull().default('UN'),
  precoVenda: real('preco_venda').notNull(),
  precoCusto: real('preco_custo').default(0),
  ncm: text('ncm'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  index('idx_produtos_tenant').on(t.tenantId),
  uniqueIndex('idx_produtos_codigo_empresa').on(t.codigo, t.empresaId),
])

export const servicos = sqliteTable('servicos', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull().references(() => empresas.id),
  codigo: text('codigo').notNull(),
  descricao: text('descricao').notNull(),
  preco: real('preco').notNull(),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
})

// ─── Estoque ──────────────────────────────────────────────────────
export const estoque = sqliteTable('estoque', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull().references(() => empresas.id),
  filialId: text('filial_id').notNull().references(() => filiais.id),
  produtoId: text('produto_id').notNull().references(() => produtos.id),
  location: text('location').notNull().default('GERAL'),
  quantidade: real('quantidade').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
}, (t) => [
  uniqueIndex('idx_estoque_unico').on(t.tenantId, t.filialId, t.produtoId),
  index('idx_estoque_filial').on(t.filialId),
])

export const movimentacoesEstoque = sqliteTable('movimentacoes_estoque', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull(),
  filialId: text('filial_id').notNull(),
  produtoId: text('produto_id').notNull(),
  tipo: text('tipo').notNull(), // entrada | saida | transferencia | ajuste
  quantidade: real('quantidade').notNull(),
  motivo: text('motivo'),
  referenciaId: text('referencia_id'), // pedido_id, nota_fiscal_id, etc.
  usuarioId: text('usuario_id'),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_mov_tenant').on(t.tenantId),
  index('idx_mov_produto').on(t.produtoId),
  index('idx_mov_data').on(t.createdAt),
])

// ─── Vendas ───────────────────────────────────────────────────────
export const pedidosVenda = sqliteTable('pedidos_venda', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull(),
  filialId: text('filial_id').notNull(),
  clienteId: text('cliente_id').notNull(),
  usuarioId: text('usuario_id'),
  numero: integer('numero').notNull(),
  tipo: text('tipo').notNull().default('pedido'), // pedido | orcamento
  status: text('status').notNull().default('rascunho'),
  total: real('total').notNull(),
  observacoes: text('observacoes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  index('idx_pedidos_tenant').on(t.tenantId),
  index('idx_pedidos_status').on(t.status),
  index('idx_pedidos_cliente').on(t.clienteId),
])

export const itensPedido = sqliteTable('itens_pedido', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  pedidoId: text('pedido_id').notNull().references(() => pedidosVenda.id),
  produtoId: text('produto_id').notNull().references(() => produtos.id),
  quantidade: real('quantidade').notNull(),
  precoUnitario: real('preco_unitario').notNull(),
  desconto: real('desconto').notNull().default(0),
  subtotal: real('subtotal').notNull(),
  createdAt: text('created_at').notNull(),
}, (t) => [
  index('idx_itens_pedido').on(t.pedidoId),
])

// ─── Financeiro ───────────────────────────────────────────────────
export const contasReceber = sqliteTable('contas_receber', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull(),
  filialId: text('filial_id').notNull(),
  pessoaId: text('pessoa_id').notNull(),
  descricao: text('descricao').notNull(),
  valor: real('valor').notNull(),
  vencimento: text('vencimento').notNull(),
  status: text('status').notNull().default('pendente'), // pendente | pago | cancelado
  dataPagamento: text('data_pagamento'),
  valorPago: real('valor_pago'),
  categoria: text('categoria'),
  observacoes: text('observacoes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  index('idx_cr_tenant').on(t.tenantId),
  index('idx_cr_vencimento').on(t.vencimento),
  index('idx_cr_status').on(t.status),
])

export const contasPagar = sqliteTable('contas_pagar', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull(),
  filialId: text('filial_id').notNull(),
  pessoaId: text('pessoa_id').notNull(),
  descricao: text('descricao').notNull(),
  valor: real('valor').notNull(),
  vencimento: text('vencimento').notNull(),
  status: text('status').notNull().default('pendente'),
  dataPagamento: text('data_pagamento'),
  valorPago: real('valor_pago'),
  categoria: text('categoria'),
  observacoes: text('observacoes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  index('idx_cp_tenant').on(t.tenantId),
  index('idx_cp_vencimento').on(t.vencimento),
])

// ─── Faturamento (NF-e / NFSe) ────────────────────────────────────
export const notasFiscais = sqliteTable('notas_fiscais', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull(),
  filialId: text('filial_id').notNull(),
  pedidoId: text('pedido_id').references(() => pedidosVenda.id),
  destinatarioId: text('destinatario_id'),
  tipo: text('tipo').notNull(), // NFe | NFSe | NFCe
  numero: integer('numero'),
  serie: text('serie').default('1'),
  chaveAcesso: text('chave_acesso').unique(),
  status: text('status').notNull().default('rascunho'), // rascunho | emitida | cancelada | denegada
  xmlPath: text('xml_path'), // caminho no R2
  valorTotal: real('valor_total'),
  motivoCancelamento: text('motivo_cancelamento'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  index('idx_nf_tenant').on(t.tenantId),
  index('idx_nf_status').on(t.status),
])
