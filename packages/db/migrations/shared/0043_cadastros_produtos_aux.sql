-- ─── Cadastros auxiliares — Produtos & serviços (redesign) ─────────
-- Migration 0043: Grupos de produtos, Unidades de medida e Tabelas de
-- preço — registros independentes (produtos.grupo/unidade continuam
-- texto livre por ora, sem migração de dados existentes).

CREATE TABLE IF NOT EXISTS grupos_produtos (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  empresa_id    TEXT,
  codigo        TEXT NOT NULL,
  descricao     TEXT NOT NULL,
  grupo_pai_id  TEXT REFERENCES grupos_produtos(id),
  ativo         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT,
  created_by    TEXT REFERENCES users(id),
  updated_by    TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_grupos_produtos_tenant ON grupos_produtos(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_grupos_produtos_codigo ON grupos_produtos(tenant_id, codigo);

CREATE TABLE IF NOT EXISTS unidades_medida (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  empresa_id        TEXT,
  sigla             TEXT NOT NULL,
  descricao         TEXT NOT NULL,
  fator_conversao   REAL NOT NULL DEFAULT 1,
  ativo             INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT,
  created_by        TEXT REFERENCES users(id),
  updated_by        TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_unidades_medida_tenant ON unidades_medida(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_unidades_medida_sigla ON unidades_medida(tenant_id, sigla);

CREATE TABLE IF NOT EXISTS tabelas_preco (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  empresa_id        TEXT,
  nome              TEXT NOT NULL,
  tipo_ajuste       TEXT NOT NULL DEFAULT 'percentual',  -- percentual | fixo
  valor_ajuste      REAL NOT NULL DEFAULT 0,
  vigencia_inicio   TEXT,
  vigencia_fim      TEXT,
  ativo             INTEGER NOT NULL DEFAULT 1,
  created_at        TEXT NOT NULL,
  updated_at        TEXT,
  created_by        TEXT REFERENCES users(id),
  updated_by        TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tabelas_preco_tenant ON tabelas_preco(tenant_id);

CREATE TABLE IF NOT EXISTS tabela_preco_itens (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  tabela_preco_id   TEXT NOT NULL REFERENCES tabelas_preco(id),
  produto_id        TEXT NOT NULL REFERENCES produtos(id),
  preco             REAL NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT,
  created_by        TEXT REFERENCES users(id),
  updated_by        TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_tabela_preco_itens_tabela ON tabela_preco_itens(tabela_preco_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tabela_preco_itens_produto ON tabela_preco_itens(tabela_preco_id, produto_id);
