-- Migration: 0004_fix_contas_nullable
-- Corrige: empresa_id e filial_id passam a ser nullable em contas_receber e contas_pagar

-- ─── contas_receber ───────────────────────────────────────────────

ALTER TABLE contas_receber RENAME TO _contas_receber_old;

CREATE TABLE contas_receber (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  empresa_id     TEXT,
  filial_id      TEXT,
  pessoa_id      TEXT NOT NULL,
  descricao      TEXT NOT NULL,
  valor          REAL NOT NULL,
  vencimento     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pendente',
  data_pagamento TEXT,
  valor_pago     REAL,
  categoria      TEXT,
  observacoes    TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT
);

INSERT INTO contas_receber
  SELECT id, tenant_id, empresa_id, filial_id, pessoa_id, descricao, valor,
         vencimento, status, data_pagamento, valor_pago, categoria, observacoes,
         created_at, updated_at
  FROM _contas_receber_old;

DROP TABLE _contas_receber_old;

CREATE INDEX IF NOT EXISTS idx_cr_tenant    ON contas_receber(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cr_vencimento ON contas_receber(vencimento);
CREATE INDEX IF NOT EXISTS idx_cr_status    ON contas_receber(status);

-- ─── contas_pagar ─────────────────────────────────────────────────

ALTER TABLE contas_pagar RENAME TO _contas_pagar_old;

CREATE TABLE contas_pagar (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  empresa_id     TEXT,
  filial_id      TEXT,
  pessoa_id      TEXT NOT NULL,
  descricao      TEXT NOT NULL,
  valor          REAL NOT NULL,
  vencimento     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pendente',
  data_pagamento TEXT,
  valor_pago     REAL,
  categoria      TEXT,
  observacoes    TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT
);

INSERT INTO contas_pagar
  SELECT id, tenant_id, empresa_id, filial_id, pessoa_id, descricao, valor,
         vencimento, status, data_pagamento, valor_pago, categoria, observacoes,
         created_at, updated_at
  FROM _contas_pagar_old;

DROP TABLE _contas_pagar_old;

CREATE INDEX IF NOT EXISTS idx_cp_tenant     ON contas_pagar(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cp_vencimento ON contas_pagar(vencimento);
