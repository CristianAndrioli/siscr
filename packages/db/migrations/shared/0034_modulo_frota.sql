-- Migration 0034: Módulo Frota — Máquinas, Obras e Ordens de Serviço

-- ─── Máquinas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS maquinas (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  empresa_id      TEXT REFERENCES empresas(id),
  nome            TEXT NOT NULL,
  modelo          TEXT,
  placa           TEXT,
  numero_serie    TEXT,
  ano_fabricacao  INTEGER,
  capacidade      TEXT,
  status          TEXT NOT NULL DEFAULT 'operacional', -- operacional | manutencao | inativa
  horimetro_atual REAL DEFAULT 0,
  observacoes     TEXT,
  ativo           INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL,
  updated_at      TEXT,
  created_by      TEXT,
  updated_by      TEXT
);
CREATE INDEX IF NOT EXISTS idx_maquinas_tenant ON maquinas(tenant_id);

-- ─── Obras / Projetos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS obras (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  empresa_id   TEXT REFERENCES empresas(id),
  nome         TEXT NOT NULL,
  cliente_id   TEXT REFERENCES pessoas(id),
  data_inicio  TEXT,
  data_fim     TEXT,
  localizacao  TEXT,
  municipio    TEXT,
  area_estimada TEXT,
  status       TEXT NOT NULL DEFAULT 'em_andamento', -- em_andamento | concluida | cancelada
  observacoes  TEXT,
  ativo        INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL,
  updated_at   TEXT,
  created_by   TEXT,
  updated_by   TEXT
);
CREATE INDEX IF NOT EXISTS idx_obras_tenant ON obras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_obras_cliente ON obras(cliente_id);

-- ─── Ordens de Serviço Frota ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ordens_servico_frota (
  id                 TEXT PRIMARY KEY,
  tenant_id          TEXT NOT NULL,
  empresa_id         TEXT REFERENCES empresas(id),
  obra_id            TEXT NOT NULL REFERENCES obras(id),
  maquina_id         TEXT REFERENCES maquinas(id),
  operador_id        TEXT NOT NULL REFERENCES pessoas(id),  -- quem operou
  servico_id         TEXT REFERENCES servicos(id),          -- tipo de serviço (do módulo cadastros)
  status             TEXT NOT NULL DEFAULT 'pendente',       -- pendente | execucao | concluido | cancelado
  descricao          TEXT,
  turno_data         TEXT NOT NULL,
  turno_inicio       TEXT,
  turno_fim          TEXT,
  horimetro_inicial  REAL,
  horimetro_final    REAL,
  horas_trabalhadas  REAL,                                   -- calculado: final - inicial
  valor_hora         REAL,                                   -- snapshot do preco do servico
  valor_total        REAL,                                   -- horas * valor_hora
  nota_fiscal_id     TEXT,                                   -- NF-e/NFS-e gerada ao faturar
  detalhes_operacao  TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT,
  created_by         TEXT,
  updated_by         TEXT
);
CREATE INDEX IF NOT EXISTS idx_osf_tenant  ON ordens_servico_frota(tenant_id);
CREATE INDEX IF NOT EXISTS idx_osf_obra    ON ordens_servico_frota(obra_id);
CREATE INDEX IF NOT EXISTS idx_osf_maquina ON ordens_servico_frota(maquina_id);
CREATE INDEX IF NOT EXISTS idx_osf_status  ON ordens_servico_frota(status);
