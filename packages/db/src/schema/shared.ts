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

/** Textos exibidos na página de planos / assinatura (editáveis via SQL). */
export const planCaracteristicas = sqliteTable('plan_caracteristicas', {
  id: text('id').primaryKey(),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  rotulo: text('rotulo').notNull(),
  ordem: integer('ordem').notNull().default(0),
}, (t) => [index('idx_plan_caracteristicas_plan').on(t.planId)])

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
  inscricaoMunicipal: text('inscricao_municipal'),
  email: text('email'),
  telefone: text('telefone'),
  logradouro: text('logradouro'),
  numero: text('numero'),
  complemento: text('complemento'),
  bairro: text('bairro'),
  cidade: text('cidade'),
  uf: text('uf'),
  cep: text('cep'),
  codigoMunicipio: text('codigo_municipio'),
  crt: text('crt'),
  cnae: text('cnae'),
  nfeSerie: text('nfe_serie'),
  nfeAmbiente: integer('nfe_ambiente'),
  nfeProximoNumero: integer('nfe_proximo_numero'),
  nfseSerie: text('nfse_serie'),
  nfseAmbiente: integer('nfse_ambiente'),
  nfseProximoNumero: integer('nfse_proximo_numero'),
  nfseCodigoServicoPadrao: text('nfse_codigo_servico_padrao'),
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
  complemento: text('complemento'),
  bairro: text('bairro'),
  cep: text('cep'),
  codigoMunicipio: text('codigo_municipio'),
  inscricaoEstadual: text('inscricao_estadual'),
  inscricaoMunicipal: text('inscricao_municipal'),
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
  complemento: text('complemento'),
  bairro: text('bairro'),
  cidade: text('cidade'),
  uf: text('uf'),
  cep: text('cep'),
  inscricaoEstadual: text('inscricao_estadual'),
  indIeDest: text('ind_ie_dest'),
  codigoMunicipio: text('codigo_municipio'),
  codigoPais: text('codigo_pais'),
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
  origem: integer('origem'),
  cest: text('cest'),
  icmsCst: text('icms_cst'),
  icmsCsosn: text('icms_csosn'),
  pisCst: text('pis_cst'),
  cofinsCst: text('cofins_cst'),
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
  // Sem filial o pedido é da matriz (ver migration 0054).
  filialId: text('filial_id'),
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

/** NF-e recebida de fornecedor (importação XML). Deve vir antes de `contasPagar` (FK opcional). */
export const nfEntradas = sqliteTable('nf_entradas', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull().references(() => empresas.id),
  filialId: text('filial_id').references(() => filiais.id),
  chaveAcesso: text('chave_acesso').notNull(),
  xmlPath: text('xml_path').notNull(),
  emitenteCnpj: text('emitente_cnpj').notNull(),
  emitenteNome: text('emitente_nome'),
  destinatarioCnpj: text('destinatario_cnpj').notNull(),
  dataEmissao: text('data_emissao'),
  numero: integer('numero'),
  serie: text('serie'),
  naturezaOperacao: text('natureza_operacao'),
  valorTotal: real('valor_total').notNull(),
  valorProdutos: real('valor_produtos'),
  fornecedorId: text('fornecedor_id').references(() => pessoas.id),
  itensJson: text('itens_json'),
  cobrancaJson: text('cobranca_json'),
  assinaturaValida: integer('assinatura_valida', { mode: 'boolean' }),
  status: text('status').notNull().default('importada'),
  /** xml | manual — lançamento sem arquivo SEFAZ */
  origem: text('origem').notNull().default('xml'),
  pedidoCompraId: text('pedido_compra_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  uniqueIndex('idx_nf_entrada_chave').on(t.tenantId, t.chaveAcesso),
  index('idx_nf_entrada_tenant').on(t.tenantId),
  index('idx_nf_entrada_origem').on(t.tenantId, t.origem),
])

export const contasPagar = sqliteTable('contas_pagar', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  empresaId: text('empresa_id').notNull(),
  filialId: text('filial_id').notNull(),
  pessoaId: text('pessoa_id').notNull(),
  nfEntradaId: text('nf_entrada_id').references(() => nfEntradas.id),
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

// ─── User Preferences (per-user UI settings) ──────────────────────
export const userPreferences = sqliteTable('user_preferences', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  tenantId: text('tenant_id').notNull(),
  // accent_color, sidebar_mode e density são colunas legadas: as opções saíram
  // da tela de Personalização e a API grava valores fixos nelas (são NOT NULL).
  accentColor: text('accent_color').notNull().default('#4f46e5'),
  sidebarMode: text('sidebar_mode').notNull().default('icons'),
  homeLayout: text('home_layout').notNull().default('grid'),    // grid | list
  theme: text('theme').notNull().default('system'),             // light | dark | system
  density: text('density').notNull().default('normal'),
  recentItemsCount: integer('recent_items_count').notNull().default(5),
  recentItems: text('recent_items').notNull().default('[]'),    // JSON array of {label,to,icon}
  visibleModules: text('visible_modules').notNull().default('[]'), // JSON array of module keys
  updatedAt: text('updated_at').notNull(),
})

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
  status: text('status').notNull().default('rascunho'), // rascunho | pendente_emissao | emitida | cancelada | denegada
  xmlPath: text('xml_path'), // caminho no R2
  valorTotal: real('valor_total'),
  motivoCancelamento: text('motivo_cancelamento'),
  ambiente: integer('ambiente'),
  modelo: integer('modelo'),
  protocoloAutorizacao: text('protocolo_autorizacao'),
  dataAutorizacao: text('data_autorizacao'),
  formaPagamento: text('forma_pagamento'),
  modFrete: integer('mod_frete'),
  valorTroco: real('valor_troco'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
}, (t) => [
  index('idx_nf_tenant').on(t.tenantId),
  index('idx_nf_status').on(t.status),
])

// ─── Mesa de suporte (agentes internos + tickets) ──────────────
export const supportAgents = sqliteTable('support_agents', {
  id: text('id').primaryKey(),
  nome: text('nome').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('agent'),
  ativo: integer('ativo', { mode: 'boolean' }).notNull().default(true),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  createdBy: text('created_by'),
  updatedAt: text('updated_at'),
})

export const supportAiSessions = sqliteTable('support_ai_sessions', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  ticketId: text('ticket_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
})

export const supportTickets = sqliteTable('support_tickets', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  tenantSlug: text('tenant_slug').notNull(),
  tenantNome: text('tenant_nome').notNull(),
  createdByUserId: text('created_by_user_id'),
  createdByNome: text('created_by_nome'),
  createdByEmail: text('created_by_email'),
  assignedAgentId: text('assigned_agent_id'),
  kind: text('kind').notNull().default('support'),
  source: text('source').notNull().default('ai'),
  status: text('status').notNull().default('open'),
  priority: text('priority').notNull().default('normal'),
  subject: text('subject').notNull(),
  parentTicketId: text('parent_ticket_id'),
  aiSessionId: text('ai_session_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
})

export const supportMessages = sqliteTable('support_messages', {
  id: text('id').primaryKey(),
  ticketId: text('ticket_id'),
  sessionId: text('session_id'),
  authorType: text('author_type').notNull(),
  authorId: text('author_id'),
  authorNome: text('author_nome'),
  body: text('body').notNull(),
  createdAt: text('created_at').notNull(),
})

