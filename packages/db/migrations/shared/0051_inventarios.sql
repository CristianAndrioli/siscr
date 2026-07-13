-- ─── Inventário / contagem de estoque (redesign) ───────────────────
-- Migration 0051: balanço de estoque — snapshot da posição atual,
-- usuário preenche a contagem física, "aplicar" gera os ajustes.

CREATE TABLE IF NOT EXISTS inventarios (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  empresa_id    TEXT,
  filial_id     TEXT,
  descricao     TEXT NOT NULL,
  location      TEXT, -- NULL = todos os locais
  status        TEXT NOT NULL DEFAULT 'aberto', -- aberto | aplicado | cancelado
  data_contagem TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT,
  created_by    TEXT REFERENCES users(id),
  updated_by    TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_inventarios_tenant ON inventarios(tenant_id);

CREATE TABLE IF NOT EXISTS inventario_itens (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  inventario_id       TEXT NOT NULL REFERENCES inventarios(id),
  produto_id          TEXT NOT NULL REFERENCES produtos(id),
  location            TEXT NOT NULL,
  quantidade_sistema  REAL NOT NULL,
  quantidade_contada  REAL,
  created_at          TEXT NOT NULL,
  updated_at          TEXT
);
CREATE INDEX IF NOT EXISTS idx_inventario_itens_inventario ON inventario_itens(inventario_id);
