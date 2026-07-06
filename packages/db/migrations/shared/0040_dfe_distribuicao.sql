-- ─── Distribuição DFe (Ambiente Nacional NF-e) ───────────────────
-- Migration 0040: estado de sincronização por empresa (NSU) e
-- documentos distribuídos (resumos e XMLs completos).

CREATE TABLE IF NOT EXISTS dfe_sync (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  empresa_id          TEXT NOT NULL,
  ult_nsu             TEXT NOT NULL DEFAULT '0',   -- último NSU processado (15 dígitos)
  max_nsu             TEXT,                        -- maior NSU disponível na SEFAZ
  ultima_consulta_em  TEXT,
  ultimo_status       TEXT,                        -- ok | erro
  ultimo_erro         TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dfe_sync_tenant_empresa ON dfe_sync(tenant_id, empresa_id);

CREATE TABLE IF NOT EXISTS dfe_documentos (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  empresa_id      TEXT NOT NULL,
  nsu             TEXT NOT NULL,
  schema_doc      TEXT NOT NULL,       -- resNFe_v1.01.xsd | procNFe_v4.00.xsd | resEvento… | procEventoNFe…
  tipo            TEXT NOT NULL,       -- resumo | nfe_completa | evento
  chave_acesso    TEXT,
  emitente_cnpj   TEXT,
  emitente_nome   TEXT,
  valor_total     REAL,
  dh_emissao      TEXT,
  xml_path        TEXT NOT NULL,       -- R2: tenants/{t}/dfe/{nsu}.xml
  status          TEXT NOT NULL DEFAULT 'novo',   -- novo | importada | ignorada
  created_at      TEXT NOT NULL,
  updated_at      TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dfe_doc_tenant_empresa_nsu ON dfe_documentos(tenant_id, empresa_id, nsu);
CREATE INDEX IF NOT EXISTS idx_dfe_doc_tenant ON dfe_documentos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dfe_doc_chave ON dfe_documentos(chave_acesso);
