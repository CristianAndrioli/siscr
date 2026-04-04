-- Migration: 0005_fix_estoque_schema
-- Corrige: empresa_id e filial_id nullable em estoque e movimentacoes_estoque
-- Altera: unique index de estoque para (tenant_id, produto_id, location)
-- Cria: tabela locais para gerenciar locais de armazenamento

-- ─── estoque: nullable + novo unique index ────────────────────────

DROP INDEX IF EXISTS idx_estoque_unico;
DROP INDEX IF EXISTS idx_estoque_filial;

ALTER TABLE estoque RENAME TO _estoque_old;

CREATE TABLE estoque (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  empresa_id TEXT,
  filial_id  TEXT,
  produto_id TEXT NOT NULL,
  location   TEXT NOT NULL DEFAULT 'GERAL',
  quantidade REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT INTO estoque
  SELECT id, tenant_id, empresa_id, filial_id, produto_id, location, quantidade, updated_at
  FROM _estoque_old;

DROP TABLE _estoque_old;

CREATE UNIQUE INDEX IF NOT EXISTS idx_estoque_unico ON estoque(tenant_id, produto_id, location);
CREATE INDEX IF NOT EXISTS idx_estoque_tenant ON estoque(tenant_id);

-- ─── movimentacoes_estoque: nullable ─────────────────────────────

ALTER TABLE movimentacoes_estoque RENAME TO _mov_old;

CREATE TABLE movimentacoes_estoque (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  empresa_id   TEXT,
  filial_id    TEXT,
  produto_id   TEXT NOT NULL,
  tipo         TEXT NOT NULL,
  quantidade   REAL NOT NULL,
  location     TEXT NOT NULL DEFAULT 'GERAL',
  motivo       TEXT,
  referencia_id TEXT,
  usuario_id   TEXT,
  created_at   TEXT NOT NULL
);

-- Copia colunas existentes; 'location' nao existia antes, fica DEFAULT 'GERAL'
INSERT INTO movimentacoes_estoque
  (id, tenant_id, empresa_id, filial_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at)
  SELECT id, tenant_id, empresa_id, filial_id, produto_id, tipo, quantidade, motivo, referencia_id, usuario_id, created_at
  FROM _mov_old;

DROP TABLE _mov_old;

CREATE INDEX IF NOT EXISTS idx_mov_tenant   ON movimentacoes_estoque(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mov_produto  ON movimentacoes_estoque(produto_id);
CREATE INDEX IF NOT EXISTS idx_mov_data     ON movimentacoes_estoque(created_at);
CREATE INDEX IF NOT EXISTS idx_mov_tipo     ON movimentacoes_estoque(tipo);

-- ─── locais: novo cadastro de locais de armazenamento ────────────

CREATE TABLE IF NOT EXISTS locais (
  id         TEXT PRIMARY KEY,
  tenant_id  TEXT NOT NULL,
  nome       TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'GERAL',
  descricao  TEXT,
  ativo      INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_locais_tenant ON locais(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_locais_nome_tenant ON locais(nome, tenant_id);

-- Local padrão não pode ser criado aqui pois não temos o tenant_id
-- O backend criará automaticamente o local GERAL ao primeiro acesso
