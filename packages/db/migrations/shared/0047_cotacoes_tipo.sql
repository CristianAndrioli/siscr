-- ─── Cotações de fornecedores (redesign) ───────────────────────────
-- Migration 0047: cotacoes ganha `tipo` para diferenciar cotação de
-- venda (orçamento a cliente, uso atual) de cotação de compra (RFQ a
-- fornecedor) — mesma tabela/itens, mesmo padrão de numeração.

ALTER TABLE cotacoes ADD COLUMN tipo TEXT NOT NULL DEFAULT 'venda';
CREATE INDEX IF NOT EXISTS idx_cotacoes_tipo ON cotacoes(tipo);
