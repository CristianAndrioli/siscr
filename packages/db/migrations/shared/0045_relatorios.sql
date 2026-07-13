-- ─── Módulo Relatórios (redesign) ───────────────────────────────────
-- Migration 0045: configurações de relatório salvas pelo usuário
-- (fonte/colunas/período/agrupamento/visualização). A consulta em si
-- (`/tenant/relatorios/query`) não persiste nada — lê direto das
-- tabelas de origem via whitelist de colunas no backend.

CREATE TABLE IF NOT EXISTS relatorios_salvos (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  empresa_id    TEXT,
  nome          TEXT NOT NULL,
  config        TEXT NOT NULL,   -- JSON: { fonte, colunas, periodo, agrupamento, visualizacao }
  created_at    TEXT NOT NULL,
  updated_at    TEXT,
  created_by    TEXT REFERENCES users(id),
  updated_by    TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_relatorios_salvos_tenant ON relatorios_salvos(tenant_id);
