-- Migration 0021: corrige índice único de nota_fiscal_id para incluir parcela
-- O índice anterior (tenant_id, nota_fiscal_id) bloqueava a inserção de múltiplas
-- parcelas da mesma nota. O novo índice permite N parcelas por nota.
DROP INDEX IF EXISTS idx_contas_receber_nota_fiscal;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_receber_nota_fiscal_parcela
  ON contas_receber(tenant_id, nota_fiscal_id, parcela)
  WHERE nota_fiscal_id IS NOT NULL;
