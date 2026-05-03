-- Régua de cobrança (issue #21): templates por perfil + etapas; vínculo opcional em contas a receber.

CREATE TABLE IF NOT EXISTS regua_cobranca (
  id TEXT PRIMARY KEY NOT NULL,
  tenant_id TEXT NOT NULL,
  nome TEXT NOT NULL,
  perfil TEXT NOT NULL DEFAULT 'geral',
  descricao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  eh_padrao INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_regua_cobranca_tenant ON regua_cobranca(tenant_id);

CREATE TABLE IF NOT EXISTS regua_cobranca_etapa (
  id TEXT PRIMARY KEY NOT NULL,
  regua_id TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  offset_dias INTEGER NOT NULL,
  canal TEXT NOT NULL,
  mensagem_template TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (regua_id) REFERENCES regua_cobranca(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_regua_cobranca_etapa_regua ON regua_cobranca_etapa(regua_id);

ALTER TABLE contas_receber ADD COLUMN regua_id TEXT REFERENCES regua_cobranca(id) ON DELETE SET NULL;
