-- ─── Abastecimentos e Manutenções programadas (redesign) ────────────
-- Migration 0050: custos operacionais de frota que ainda não tinham
-- registro — só existia maquinas.horimetro_atual e maquinas.status
-- ('manutencao' como estado, sem histórico/agenda).

CREATE TABLE IF NOT EXISTS abastecimentos_frota (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  empresa_id    TEXT,
  maquina_id    TEXT NOT NULL REFERENCES maquinas(id),
  obra_id       TEXT REFERENCES obras(id),
  data          TEXT NOT NULL,
  litros        REAL NOT NULL,
  valor_total   REAL NOT NULL,
  horimetro     REAL,
  posto         TEXT,
  observacoes   TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT,
  created_by    TEXT REFERENCES users(id),
  updated_by    TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_frota_tenant ON abastecimentos_frota(tenant_id);
CREATE INDEX IF NOT EXISTS idx_abastecimentos_frota_maquina ON abastecimentos_frota(maquina_id);

CREATE TABLE IF NOT EXISTS manutencoes_frota (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  empresa_id          TEXT,
  maquina_id          TEXT NOT NULL REFERENCES maquinas(id),
  tipo                TEXT NOT NULL DEFAULT 'preventiva', -- preventiva | corretiva
  descricao           TEXT NOT NULL,
  data_prevista       TEXT,
  data_realizada      TEXT,
  horimetro_previsto  REAL,
  status              TEXT NOT NULL DEFAULT 'pendente', -- pendente | concluida | cancelada
  custo               REAL,
  observacoes         TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT,
  created_by          TEXT REFERENCES users(id),
  updated_by          TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_manutencoes_frota_tenant ON manutencoes_frota(tenant_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_frota_maquina ON manutencoes_frota(maquina_id);
CREATE INDEX IF NOT EXISTS idx_manutencoes_frota_status ON manutencoes_frota(status);
