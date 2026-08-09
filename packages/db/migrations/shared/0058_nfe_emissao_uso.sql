-- Cota mensal de NF-e autorizadas (gancho para pacotes comerciais)
CREATE TABLE IF NOT EXISTS nfe_emissao_uso (
  tenant_id TEXT NOT NULL,
  ym TEXT NOT NULL,
  qtd INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  PRIMARY KEY (tenant_id, ym)
);

CREATE INDEX IF NOT EXISTS idx_nfe_emissao_uso_ym ON nfe_emissao_uso (ym);
