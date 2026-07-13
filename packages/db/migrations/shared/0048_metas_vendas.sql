-- ─── Metas de vendas (redesign) ─────────────────────────────────────
-- Migration 0048: meta mensal por vendedor (papel pessoas.tipo_cadastro
-- ='vendedor', desde 0042). Realizado é calculado a partir de
-- pedidos_venda.status='faturado' no período — precisa saber qual
-- vendedor originou o pedido (não existia antes).

CREATE TABLE IF NOT EXISTS metas_vendas (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  empresa_id    TEXT,
  vendedor_id   TEXT NOT NULL REFERENCES pessoas(id),
  ano           INTEGER NOT NULL,
  mes           INTEGER NOT NULL,
  valor_meta    REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT,
  created_by    TEXT REFERENCES users(id),
  updated_by    TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_metas_vendas_tenant ON metas_vendas(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_vendas_periodo ON metas_vendas(tenant_id, vendedor_id, ano, mes);

ALTER TABLE pedidos_venda ADD COLUMN vendedor_id TEXT REFERENCES pessoas(id);
