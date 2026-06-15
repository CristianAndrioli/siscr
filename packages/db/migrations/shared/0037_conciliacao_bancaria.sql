-- Migration 0037: Conciliação Bancária via OFX/API

-- Sessões de conciliação
CREATE TABLE IF NOT EXISTS conciliacao_bancaria (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  conta_bancaria_id TEXT NOT NULL REFERENCES contas_bancarias(id),
  arquivo_nome TEXT,
  data_inicio TEXT,        -- período do extrato (YYYY-MM-DD)
  data_fim TEXT,           -- período do extrato (YYYY-MM-DD)
  saldo_inicial REAL,      -- saldo informado no início do extrato
  saldo_final REAL,        -- saldo informado no fim do extrato (LEDGERBAL)
  total_creditos REAL NOT NULL DEFAULT 0,
  total_debitos REAL NOT NULL DEFAULT 0,
  total_itens INTEGER NOT NULL DEFAULT 0,
  itens_conciliados INTEGER NOT NULL DEFAULT 0,
  itens_ignorados INTEGER NOT NULL DEFAULT 0,
  itens_manuais INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'finalizado',
  created_at TEXT NOT NULL,
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_conciliacao_tenant ON conciliacao_bancaria(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conciliacao_conta  ON conciliacao_bancaria(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_conciliacao_data   ON conciliacao_bancaria(data_inicio);

-- Itens individuais por sessão de conciliação
CREATE TABLE IF NOT EXISTS conciliacao_itens (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  conciliacao_id TEXT NOT NULL REFERENCES conciliacao_bancaria(id),
  ofx_fitid TEXT,           -- FITID do OFX (identificador único da transação no banco)
  tipo TEXT NOT NULL,        -- credito | debito
  valor REAL NOT NULL,
  data TEXT NOT NULL,        -- YYYY-MM-DD
  descricao TEXT,
  status TEXT NOT NULL,      -- conciliado | ignorado | manual
  -- Vínculo com registros financeiros do sistema
  movimento_id TEXT,         -- ID em movimentos_bancarios (criado na conciliação)
  origem_tipo TEXT,          -- contas_receber | contas_pagar | null
  origem_id TEXT,            -- ID do registro vinculado
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ci_conciliacao ON conciliacao_itens(conciliacao_id);
CREATE INDEX IF NOT EXISTS idx_ci_tenant      ON conciliacao_itens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_fitid       ON conciliacao_itens(ofx_fitid);
