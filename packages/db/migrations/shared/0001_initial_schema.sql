-- Migration: 0001_initial_schema
-- Banco: siscr-shared (D1 Cloudflare)
-- Descrição: Schema inicial completo do ERP SaaS multi-tenant

-- ─── Planos ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  preco_mensal REAL NOT NULL DEFAULT 0,
  preco_anual REAL NOT NULL DEFAULT 0,
  max_empresas INTEGER NOT NULL DEFAULT 1,
  max_filiais INTEGER NOT NULL DEFAULT 3,
  max_usuarios INTEGER NOT NULL DEFAULT 5,
  features TEXT, -- JSON
  ativo INTEGER NOT NULL DEFAULT 1,
  stripe_price_id_mensal TEXT,
  stripe_price_id_anual TEXT,
  created_at TEXT NOT NULL
);

-- Planos padrão
INSERT OR IGNORE INTO plans (id, nome, preco_mensal, preco_anual, max_empresas, max_filiais, max_usuarios, ativo, created_at)
VALUES
  ('free',       'Free',       0,      0,      1,   2,   3,  1, datetime('now')),
  ('starter',    'Starter',    97,     970,    1,   5,   10, 1, datetime('now')),
  ('business',   'Business',   297,    2970,   3,   20,  50, 1, datetime('now')),
  ('enterprise', 'Enterprise', 997,    9970,   99,  999, 999,1, datetime('now'));

-- ─── Tenants ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  plan_id TEXT REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  subscription_expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- ─── Usuários ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  nome TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_tenant ON users(email, tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- ─── Empresas ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT NOT NULL,
  inscricao_estadual TEXT,
  email TEXT,
  telefone TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_empresas_tenant ON empresas(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_cnpj_tenant ON empresas(cnpj, tenant_id);

-- ─── Filiais ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS filiais (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  cnpj TEXT,
  uf TEXT,
  cidade TEXT,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  cep TEXT,
  ativa INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_filiais_tenant ON filiais(tenant_id);
CREATE INDEX IF NOT EXISTS idx_filiais_empresa ON filiais(empresa_id);

-- ─── Permissões de usuário ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_permissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  empresa_id TEXT REFERENCES empresas(id),
  filial_id TEXT REFERENCES filiais(id),
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_perms_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_perms_tenant ON user_permissions(tenant_id);

-- ─── Cadastros ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pessoas (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  filial_id TEXT REFERENCES filiais(id),
  tipo TEXT NOT NULL,
  tipo_cadastro TEXT NOT NULL,
  nome TEXT NOT NULL,
  cpf_cnpj TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pessoas_tenant ON pessoas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_empresa ON pessoas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_tipo ON pessoas(tipo_cadastro);

CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'UN',
  preco_venda REAL NOT NULL,
  preco_custo REAL DEFAULT 0,
  ncm TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_produtos_tenant ON produtos(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_codigo_empresa ON produtos(codigo, empresa_id);

CREATE TABLE IF NOT EXISTS servicos (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  codigo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  preco REAL NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

-- ─── Estoque ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  filial_id TEXT NOT NULL REFERENCES filiais(id),
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  location TEXT NOT NULL DEFAULT 'GERAL',
  quantidade REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_estoque_unico ON estoque(tenant_id, filial_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_estoque_filial ON estoque(filial_id);

CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  produto_id TEXT NOT NULL,
  tipo TEXT NOT NULL,
  quantidade REAL NOT NULL,
  motivo TEXT,
  referencia_id TEXT,
  usuario_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mov_tenant ON movimentacoes_estoque(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mov_produto ON movimentacoes_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_data ON movimentacoes_estoque(created_at);

-- ─── Vendas ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pedidos_venda (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  cliente_id TEXT NOT NULL,
  usuario_id TEXT,
  numero INTEGER NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'pedido',
  status TEXT NOT NULL DEFAULT 'rascunho',
  total REAL NOT NULL,
  observacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pedidos_tenant ON pedidos_venda(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos_venda(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos_venda(cliente_id);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  pedido_id TEXT NOT NULL REFERENCES pedidos_venda(id),
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  quantidade REAL NOT NULL,
  preco_unitario REAL NOT NULL,
  desconto REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_itens_pedido ON itens_pedido(pedido_id);

-- ─── Financeiro ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contas_receber (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  pessoa_id TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  vencimento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_pagamento TEXT,
  valor_pago REAL,
  categoria TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cr_tenant ON contas_receber(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cr_vencimento ON contas_receber(vencimento);
CREATE INDEX IF NOT EXISTS idx_cr_status ON contas_receber(status);

CREATE TABLE IF NOT EXISTS contas_pagar (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  pessoa_id TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor REAL NOT NULL,
  vencimento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  data_pagamento TEXT,
  valor_pago REAL,
  categoria TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cp_tenant ON contas_pagar(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cp_vencimento ON contas_pagar(vencimento);

-- ─── Faturamento ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notas_fiscais (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  empresa_id TEXT NOT NULL,
  filial_id TEXT NOT NULL,
  pedido_id TEXT REFERENCES pedidos_venda(id),
  destinatario_id TEXT,
  tipo TEXT NOT NULL,
  numero INTEGER,
  serie TEXT DEFAULT '1',
  chave_acesso TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'rascunho',
  xml_path TEXT,
  valor_total REAL,
  motivo_cancelamento TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_nf_tenant ON notas_fiscais(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nf_status ON notas_fiscais(status);
