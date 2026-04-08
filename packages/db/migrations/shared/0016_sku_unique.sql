-- Migration 0016: SKU único por tenant
-- WHERE sku IS NOT NULL permite vários registros sem SKU (NULL != NULL no SQLite)

CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_sku_tenant
  ON produtos(tenant_id, sku)
  WHERE sku IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_servicos_sku_tenant
  ON servicos(tenant_id, sku)
  WHERE sku IS NOT NULL;
