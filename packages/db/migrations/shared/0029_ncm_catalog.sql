-- Catálogo NCM compartilhado (todos os tenants). Uma importação ativa por vez (batch_id em ncm_meta).

CREATE TABLE IF NOT EXISTS ncm_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ncm_sync_runs (
  id               TEXT PRIMARY KEY,
  source           TEXT NOT NULL,
  status           TEXT NOT NULL,
  message          TEXT,
  row_count        INTEGER,
  content_sha256   TEXT,
  payload_meta     TEXT,
  started_at       TEXT NOT NULL,
  finished_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_ncm_sync_runs_started
  ON ncm_sync_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS ncm_items (
  id               TEXT PRIMARY KEY,
  batch_id         TEXT NOT NULL,
  codigo_raw       TEXT NOT NULL,
  codigo_8         TEXT,
  descricao        TEXT NOT NULL,
  vigencia_inicio  TEXT NOT NULL,
  vigencia_fim     TEXT NOT NULL,
  tipo_ato_ini     TEXT,
  numero_ato_ini   TEXT,
  ano_ato_ini      TEXT
);

CREATE INDEX IF NOT EXISTS idx_ncm_items_batch ON ncm_items (batch_id);
CREATE INDEX IF NOT EXISTS idx_ncm_items_codigo8 ON ncm_items (codigo_8);
