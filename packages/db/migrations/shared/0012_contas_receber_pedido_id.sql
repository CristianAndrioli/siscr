-- Vínculo pedido → título a receber (núcleo operacional: faturamento gera financeiro)
ALTER TABLE contas_receber ADD COLUMN pedido_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contas_receber_tenant_pedido
  ON contas_receber(tenant_id, pedido_id)
  WHERE pedido_id IS NOT NULL;
