-- ─── Histórico de interações (redesign) ─────────────────────────────
-- Migration 0049: log de CRM — contatos com clientes/fornecedores.

CREATE TABLE IF NOT EXISTS pessoa_interacoes (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  pessoa_id     TEXT NOT NULL REFERENCES pessoas(id),
  tipo          TEXT NOT NULL DEFAULT 'outro', -- ligacao|email|reuniao|visita|outro
  data          TEXT NOT NULL,
  descricao     TEXT NOT NULL,
  usuario_id    TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT,
  created_by    TEXT REFERENCES users(id),
  updated_by    TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pessoa_interacoes_tenant ON pessoa_interacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pessoa_interacoes_pessoa ON pessoa_interacoes(pessoa_id);
