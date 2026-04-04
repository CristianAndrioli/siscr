-- Migration: 0003_fix_cadastros_nullable
-- Corrige: empresa_id e cpf_cnpj nullable em pessoas
--          empresa_id nullable em produtos e servicos
--          adiciona coluna unidade e updated_at em servicos (faltavam)

-- ─── pessoas: empresa_id e cpf_cnpj passam a ser nullable ────────

ALTER TABLE pessoas RENAME TO _pessoas_old;

CREATE TABLE pessoas (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  empresa_id   TEXT REFERENCES empresas(id),
  filial_id    TEXT REFERENCES filiais(id),
  tipo         TEXT NOT NULL,
  tipo_cadastro TEXT NOT NULL,
  nome         TEXT NOT NULL,
  cpf_cnpj     TEXT,
  email        TEXT,
  telefone     TEXT,
  logradouro   TEXT,
  numero       TEXT,
  bairro       TEXT,
  cidade       TEXT,
  uf           TEXT,
  cep          TEXT,
  ativo        INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT
);

INSERT INTO pessoas
  SELECT id, tenant_id, empresa_id, filial_id, tipo, tipo_cadastro, nome,
         cpf_cnpj, email, telefone, logradouro, numero, bairro, cidade,
         uf, cep, ativo, created_at, updated_at
  FROM _pessoas_old;

DROP TABLE _pessoas_old;

CREATE INDEX IF NOT EXISTS idx_pessoas_tenant ON pessoas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_empresa ON pessoas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_tipo ON pessoas(tipo_cadastro);

-- ─── produtos: empresa_id passa a ser nullable ────────────────────

ALTER TABLE produtos RENAME TO _produtos_old;

CREATE TABLE produtos (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  empresa_id  TEXT REFERENCES empresas(id),
  codigo      TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  unidade     TEXT NOT NULL DEFAULT 'UN',
  preco_venda REAL NOT NULL,
  preco_custo REAL DEFAULT 0,
  ncm         TEXT,
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);

INSERT INTO produtos
  SELECT id, tenant_id, empresa_id, codigo, descricao, unidade,
         preco_venda, preco_custo, ncm, ativo, created_at, updated_at
  FROM _produtos_old;

DROP TABLE _produtos_old;

CREATE INDEX IF NOT EXISTS idx_produtos_tenant ON produtos(tenant_id);
-- Índice único por código dentro do tenant (empresa pode ser null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_codigo_tenant ON produtos(codigo, tenant_id);

-- ─── servicos: empresa_id nullable + adiciona unidade / updated_at ─

ALTER TABLE servicos RENAME TO _servicos_old;

CREATE TABLE servicos (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  empresa_id  TEXT REFERENCES empresas(id),
  codigo      TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  unidade     TEXT NOT NULL DEFAULT 'UN',
  preco       REAL NOT NULL,
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);

-- Copia apenas as colunas que existiam antes (sem unidade/updated_at)
INSERT INTO servicos (id, tenant_id, empresa_id, codigo, descricao, preco, ativo, created_at)
  SELECT id, tenant_id, empresa_id, codigo, descricao, preco, ativo, created_at
  FROM _servicos_old;

DROP TABLE _servicos_old;

CREATE INDEX IF NOT EXISTS idx_servicos_tenant ON servicos(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_servicos_codigo_tenant ON servicos(codigo, tenant_id);
