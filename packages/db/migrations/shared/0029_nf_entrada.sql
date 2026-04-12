-- NF-e de entrada (compras): importação manual de XML + vínculo com contas a pagar

CREATE TABLE IF NOT EXISTS nf_entradas (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  empresa_id           TEXT NOT NULL REFERENCES empresas(id),
  filial_id            TEXT REFERENCES filiais(id),
  chave_acesso         TEXT NOT NULL,
  xml_path             TEXT NOT NULL,
  emitente_cnpj        TEXT NOT NULL,
  emitente_nome        TEXT,
  destinatario_cnpj    TEXT NOT NULL,
  data_emissao         TEXT,
  numero               INTEGER,
  serie                TEXT,
  natureza_operacao    TEXT,
  valor_total          REAL NOT NULL,
  valor_produtos       REAL,
  fornecedor_id        TEXT REFERENCES pessoas(id),
  itens_json           TEXT,
  cobranca_json        TEXT,
  assinatura_valida    INTEGER DEFAULT 0,
  status               TEXT NOT NULL DEFAULT 'importada',
  created_at           TEXT NOT NULL,
  updated_at           TEXT,
  created_by           TEXT REFERENCES users(id),
  updated_by           TEXT REFERENCES users(id),
  UNIQUE (tenant_id, chave_acesso)
);

CREATE INDEX IF NOT EXISTS idx_nf_entrada_tenant ON nf_entradas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nf_entrada_empresa ON nf_entradas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_nf_entrada_fornecedor ON nf_entradas(fornecedor_id);

ALTER TABLE contas_pagar ADD COLUMN nf_entrada_id TEXT REFERENCES nf_entradas(id);
CREATE INDEX IF NOT EXISTS idx_cp_nf_entrada ON contas_pagar(nf_entrada_id);
