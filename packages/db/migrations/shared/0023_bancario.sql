-- Migration 0023: contas bancárias e movimentos bancários
CREATE TABLE IF NOT EXISTS contas_bancarias (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  empresa_id TEXT,
  nome TEXT NOT NULL,
  banco_codigo TEXT,
  banco_nome TEXT,
  agencia TEXT,
  conta TEXT,
  tipo TEXT NOT NULL DEFAULT 'corrente',  -- corrente | poupanca | caixa | investimento
  saldo_inicial REAL NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_cb_tenant ON contas_bancarias(tenant_id);

CREATE TABLE IF NOT EXISTS movimentos_bancarios (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  conta_bancaria_id TEXT NOT NULL REFERENCES contas_bancarias(id),
  tipo TEXT NOT NULL,           -- credito | debito
  valor REAL NOT NULL,
  data TEXT NOT NULL,
  descricao TEXT,
  origem_tipo TEXT,             -- contas_receber | contas_pagar | manual | transferencia
  origem_id TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_mb_tenant ON movimentos_bancarios(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mb_conta ON movimentos_bancarios(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_mb_data ON movimentos_bancarios(data);

-- Coluna na baixa para rastrear em qual conta o dinheiro entrou/saiu
ALTER TABLE contas_receber ADD COLUMN conta_bancaria_id TEXT;
ALTER TABLE contas_pagar ADD COLUMN conta_bancaria_id TEXT;
