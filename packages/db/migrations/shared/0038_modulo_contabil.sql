-- ─── Módulo Contábil ─────────────────────────────────────────────
-- Migration 0038: plano_contas, lancamentos_contabeis, centros_custo
-- Compatível com Simples Nacional (base para ECD)

-- ─── Regime tributário em empresas ───────────────────────────────
ALTER TABLE empresas ADD COLUMN regime_tributario TEXT DEFAULT 'simples_nacional';
-- simples_nacional | lucro_presumido | lucro_real | mei

-- ─── Centros de custo ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS centros_custo (
  id          TEXT PRIMARY KEY,
  tenant_id   TEXT NOT NULL,
  empresa_id  TEXT,
  codigo      TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  ativo       INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_cc_tenant ON centros_custo(tenant_id);

-- ─── Plano de contas ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS plano_contas (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  empresa_id          TEXT,
  codigo              TEXT NOT NULL,          -- ex: "1.1.01.001"
  descricao           TEXT NOT NULL,
  tipo                TEXT NOT NULL,          -- ativo | passivo | pl | receita | despesa | custo
  natureza            TEXT NOT NULL,          -- devedora | credora
  nivel               INTEGER NOT NULL,       -- 1..6
  conta_pai_id        TEXT,
  aceita_lancamento   INTEGER NOT NULL DEFAULT 0,  -- 1 = analítica (recebe lançamentos)
  ativo               INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL,
  updated_at          TEXT,
  FOREIGN KEY (conta_pai_id) REFERENCES plano_contas(id)
);
CREATE INDEX IF NOT EXISTS idx_pc_tenant   ON plano_contas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pc_codigo   ON plano_contas(tenant_id, codigo);

-- ─── Lançamentos contábeis (partida dobrada) ─────────────────────
CREATE TABLE IF NOT EXISTS lancamentos_contabeis (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  empresa_id      TEXT,
  numero          INTEGER,                    -- sequencial anual por empresa
  data_lancamento TEXT NOT NULL,              -- YYYY-MM-DD
  historico       TEXT NOT NULL,
  origem_tipo     TEXT,                       -- nfe_saida | nfe_entrada | cr_pagamento | cp_pagamento | manual | conciliacao
  origem_id       TEXT,                       -- id da entidade de origem
  status          TEXT NOT NULL DEFAULT 'ativo',  -- ativo | estornado
  estorno_id      TEXT,                       -- id do lançamento de estorno
  created_by      TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_lc_tenant   ON lancamentos_contabeis(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lc_data     ON lancamentos_contabeis(tenant_id, data_lancamento);
CREATE INDEX IF NOT EXISTS idx_lc_origem   ON lancamentos_contabeis(origem_tipo, origem_id);

-- ─── Partidas dos lançamentos (débito/crédito) ───────────────────
CREATE TABLE IF NOT EXISTS lancamentos_contabeis_itens (
  id                     TEXT PRIMARY KEY,
  tenant_id              TEXT NOT NULL,
  lancamento_id          TEXT NOT NULL REFERENCES lancamentos_contabeis(id) ON DELETE CASCADE,
  conta_id               TEXT NOT NULL REFERENCES plano_contas(id),
  debito                 REAL NOT NULL DEFAULT 0,
  credito                REAL NOT NULL DEFAULT 0,
  centro_custo_id        TEXT,
  historico_complementar TEXT,
  created_at             TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lci_lancamento ON lancamentos_contabeis_itens(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_lci_conta      ON lancamentos_contabeis_itens(tenant_id, conta_id);
