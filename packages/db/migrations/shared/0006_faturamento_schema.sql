-- Migration 0006: faturamento schema
-- Corrige notas_fiscais (nullable), cria cotacoes, cotacao_itens, nota_fiscal_itens

-- ─── notas_fiscais: nullable empresa_id/filial_id + novos campos ─

ALTER TABLE notas_fiscais RENAME TO _nf_old;

CREATE TABLE notas_fiscais (
  id                   TEXT PRIMARY KEY,
  tenant_id            TEXT NOT NULL,
  empresa_id           TEXT,
  filial_id            TEXT,
  pedido_id            TEXT,
  destinatario_id      TEXT,
  tipo                 TEXT NOT NULL DEFAULT 'nfe', -- nfe | nfse
  numero               INTEGER,
  serie                TEXT DEFAULT '1',
  chave_acesso         TEXT UNIQUE,
  status               TEXT NOT NULL DEFAULT 'rascunho',
  -- nfe
  natureza_operacao    TEXT,
  -- nfse
  descricao_servico    TEXT,
  aliquota_iss         REAL,
  valor_iss            REAL,
  codigo_servico       TEXT,
  -- comuns
  xml_path             TEXT,
  valor_produtos       REAL DEFAULT 0,
  valor_desconto       REAL DEFAULT 0,
  valor_total          REAL DEFAULT 0,
  observacoes          TEXT,
  motivo_cancelamento  TEXT,
  data_emissao         TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT
);

INSERT INTO notas_fiscais
  (id, tenant_id, empresa_id, filial_id, pedido_id, destinatario_id, tipo,
   numero, serie, chave_acesso, status, xml_path, valor_total,
   motivo_cancelamento, created_at, updated_at)
  SELECT id, tenant_id, empresa_id, filial_id, pedido_id, destinatario_id, tipo,
         numero, serie, chave_acesso, status, xml_path, valor_total,
         motivo_cancelamento, created_at, updated_at
  FROM _nf_old;

DROP TABLE _nf_old;

CREATE INDEX IF NOT EXISTS idx_nf_tenant ON notas_fiscais(tenant_id);
CREATE INDEX IF NOT EXISTS idx_nf_status ON notas_fiscais(status);
CREATE INDEX IF NOT EXISTS idx_nf_tipo   ON notas_fiscais(tipo);

-- ─── nota_fiscal_itens ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nota_fiscal_itens (
  id             TEXT PRIMARY KEY,
  nota_fiscal_id TEXT NOT NULL REFERENCES notas_fiscais(id) ON DELETE CASCADE,
  tenant_id      TEXT NOT NULL,
  produto_id     TEXT,
  servico_id     TEXT,
  descricao      TEXT NOT NULL,
  quantidade     REAL NOT NULL DEFAULT 1,
  valor_unitario REAL NOT NULL DEFAULT 0,
  desconto       REAL NOT NULL DEFAULT 0,
  valor_total    REAL NOT NULL DEFAULT 0,
  cfop           TEXT,
  ncm            TEXT,
  unidade        TEXT DEFAULT 'UN',
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nfi_nota ON nota_fiscal_itens(nota_fiscal_id);

-- ─── cotacoes ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cotacoes (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  numero       TEXT NOT NULL,
  pessoa_id    TEXT,
  validade     TEXT,
  observacoes  TEXT,
  desconto     REAL NOT NULL DEFAULT 0,
  valor_total  REAL NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'rascunho', -- rascunho | enviada | aprovada | recusada | expirada
  created_at   TEXT NOT NULL,
  updated_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_cot_tenant ON cotacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cot_status ON cotacoes(status);

-- ─── cotacao_itens ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cotacao_itens (
  id             TEXT PRIMARY KEY,
  cotacao_id     TEXT NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  tenant_id      TEXT NOT NULL,
  produto_id     TEXT,
  servico_id     TEXT,
  descricao      TEXT NOT NULL,
  quantidade     REAL NOT NULL DEFAULT 1,
  valor_unitario REAL NOT NULL DEFAULT 0,
  desconto       REAL NOT NULL DEFAULT 0,
  valor_total    REAL NOT NULL DEFAULT 0,
  unidade        TEXT DEFAULT 'UN',
  created_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ci_cotacao ON cotacao_itens(cotacao_id);
