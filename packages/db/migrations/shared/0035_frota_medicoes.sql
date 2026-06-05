-- Migration 0035: Frota — alocação de máquinas em obras, medições e notas parciais

-- ─── Alocação de máquinas em obras (várias máquinas por obra) ─────────────────
CREATE TABLE IF NOT EXISTS obra_maquinas (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  obra_id        TEXT NOT NULL REFERENCES obras(id),
  maquina_id     TEXT NOT NULL REFERENCES maquinas(id),
  valor_hora     REAL,                          -- rate padrão da máquina nesta obra
  data_alocacao  TEXT,
  data_liberacao TEXT,
  observacoes    TEXT,
  ativo          INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT,
  created_by     TEXT,
  updated_by     TEXT
);
CREATE INDEX IF NOT EXISTS idx_obra_maquinas_obra    ON obra_maquinas(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_maquinas_maquina ON obra_maquinas(maquina_id);
CREATE INDEX IF NOT EXISTS idx_obra_maquinas_tenant  ON obra_maquinas(tenant_id);

-- ─── Medições / Notas parciais por obra ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS medicoes_frota (
  id             TEXT PRIMARY KEY,
  tenant_id      TEXT NOT NULL,
  empresa_id     TEXT REFERENCES empresas(id),
  obra_id        TEXT NOT NULL REFERENCES obras(id),
  numero         INTEGER NOT NULL,              -- sequencial por obra
  descricao      TEXT,
  periodo_inicio TEXT,
  periodo_fim    TEXT,
  total_horas    REAL DEFAULT 0,
  valor_total    REAL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'rascunho', -- rascunho | faturada | cancelada
  nota_fiscal_id TEXT,                           -- NFS-e gerada para a medição
  created_at     TEXT NOT NULL,
  updated_at     TEXT,
  created_by     TEXT,
  updated_by     TEXT
);
CREATE INDEX IF NOT EXISTS idx_medicoes_obra   ON medicoes_frota(obra_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_tenant ON medicoes_frota(tenant_id);

-- ─── Colunas novas em obras ──────────────────────────────────────────────────
ALTER TABLE obras ADD COLUMN data_conclusao TEXT;
ALTER TABLE obras ADD COLUMN valor_faturado REAL DEFAULT 0;

-- ─── Vínculo da OS à medição ─────────────────────────────────────────────────
ALTER TABLE ordens_servico_frota ADD COLUMN medicao_id TEXT;
CREATE INDEX IF NOT EXISTS idx_osf_medicao ON ordens_servico_frota(medicao_id);
