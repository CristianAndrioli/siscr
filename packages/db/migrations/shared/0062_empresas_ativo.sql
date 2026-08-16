-- Soft-disable de empresa (mesa de suporte e operação no ERP).
ALTER TABLE empresas ADD COLUMN ativo INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_empresas_ativo ON empresas (tenant_id, ativo);
