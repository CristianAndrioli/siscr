-- Migration 0032: Recebimento parcial em Contas a Receber e Contas a Pagar
-- Cria tabelas de histórico de pagamentos e adiciona coluna de saldo acumulado.
-- O status 'parcialmente_pago' é tratado em application level (SQLite não tem enum com ALTER TABLE).

-- ─── Histórico de recebimentos (Contas a Receber) ─────────────────────────────

CREATE TABLE IF NOT EXISTS contas_receber_pagamentos (
  id                TEXT PRIMARY KEY,
  tenant_id         TEXT NOT NULL,
  conta_receber_id  TEXT NOT NULL REFERENCES contas_receber(id) ON DELETE CASCADE,
  data_pagamento    TEXT NOT NULL,
  valor             REAL NOT NULL,
  conta_bancaria_id TEXT,
  observacao        TEXT,
  created_at        TEXT NOT NULL,
  created_by        TEXT
);

CREATE INDEX IF NOT EXISTS idx_crp_conta ON contas_receber_pagamentos(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_crp_tenant ON contas_receber_pagamentos(tenant_id);

-- ─── Histórico de pagamentos (Contas a Pagar) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS contas_pagar_pagamentos (
  id               TEXT PRIMARY KEY,
  tenant_id        TEXT NOT NULL,
  conta_pagar_id   TEXT NOT NULL REFERENCES contas_pagar(id) ON DELETE CASCADE,
  data_pagamento   TEXT NOT NULL,
  valor            REAL NOT NULL,
  conta_bancaria_id TEXT,
  observacao       TEXT,
  created_at       TEXT NOT NULL,
  created_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_cpp_conta ON contas_pagar_pagamentos(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_cpp_tenant ON contas_pagar_pagamentos(tenant_id);
