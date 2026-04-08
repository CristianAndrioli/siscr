-- Migration 0019: vínculo nota fiscal → contas a receber
-- Permite rastrear qual nota gerou o título e evitar duplicatas
ALTER TABLE contas_receber ADD COLUMN nota_fiscal_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_receber_nota_fiscal
  ON contas_receber(tenant_id, nota_fiscal_id)
  WHERE nota_fiscal_id IS NOT NULL;
