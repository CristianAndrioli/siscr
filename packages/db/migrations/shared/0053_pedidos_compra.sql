-- ─── Pedidos de compra + Recebimento (redesign) ─────────────────────
-- Migration 0053: espelha pedidos_venda/itens_pedido para o lado de
-- compras, com recebimento parcial/total que gera entrada de estoque.

CREATE TABLE IF NOT EXISTS pedidos_compra (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  empresa_id     TEXT NOT NULL,
  filial_id      TEXT NOT NULL,
  fornecedor_id  TEXT NOT NULL REFERENCES pessoas(id),
  usuario_id     TEXT REFERENCES users(id),
  numero         INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'rascunho', -- rascunho|confirmado|recebido_parcial|recebido|cancelado
  total          REAL NOT NULL DEFAULT 0,
  observacoes    TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT,
  created_by     TEXT REFERENCES users(id),
  updated_by     TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_tenant ON pedidos_compra(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_compra_status ON pedidos_compra(tenant_id, status);

CREATE TABLE IF NOT EXISTS itens_pedido_compra (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  pedido_id            TEXT NOT NULL REFERENCES pedidos_compra(id),
  produto_id           TEXT NOT NULL REFERENCES produtos(id),
  quantidade           REAL NOT NULL,
  quantidade_recebida  REAL NOT NULL DEFAULT 0,
  preco_unitario       REAL NOT NULL,
  subtotal             REAL NOT NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT,
  created_by           TEXT REFERENCES users(id),
  updated_by           TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_itens_pedido_compra_pedido ON itens_pedido_compra(pedido_id);

CREATE TABLE IF NOT EXISTS recebimentos_compra (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  pedido_id     TEXT NOT NULL REFERENCES pedidos_compra(id),
  location      TEXT NOT NULL DEFAULT 'GERAL',
  observacoes   TEXT,
  created_at    TEXT NOT NULL,
  created_by    TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_recebimentos_compra_pedido ON recebimentos_compra(pedido_id);

CREATE TABLE IF NOT EXISTS recebimento_itens (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  recebimento_id  TEXT NOT NULL REFERENCES recebimentos_compra(id),
  item_pedido_id  TEXT NOT NULL REFERENCES itens_pedido_compra(id),
  quantidade      REAL NOT NULL,
  created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recebimento_itens_recebimento ON recebimento_itens(recebimento_id);
