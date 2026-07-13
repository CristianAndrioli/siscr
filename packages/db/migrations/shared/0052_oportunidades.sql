-- ─── Funil de vendas / Oportunidades (redesign) ─────────────────────
-- Migration 0052: Kanban de oportunidades comerciais.

CREATE TABLE IF NOT EXISTS oportunidades (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  empresa_id                TEXT,
  filial_id                 TEXT,
  titulo                    TEXT NOT NULL,
  pessoa_id                 TEXT REFERENCES pessoas(id),
  vendedor_id               TEXT REFERENCES pessoas(id),
  valor_estimado            REAL NOT NULL DEFAULT 0,
  estagio                   TEXT NOT NULL DEFAULT 'novo', -- novo|qualificado|proposta|negociacao|ganho|perdido
  probabilidade             INTEGER NOT NULL DEFAULT 0,
  data_prevista_fechamento  TEXT,
  motivo_perda              TEXT,
  created_at                TEXT NOT NULL,
  updated_at                TEXT,
  created_by                TEXT REFERENCES users(id),
  updated_by                TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_oportunidades_tenant ON oportunidades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_estagio ON oportunidades(tenant_id, estagio);
