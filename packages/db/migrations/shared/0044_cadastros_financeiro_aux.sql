-- ─── Cadastros auxiliares — Financeiro (redesign) ──────────────────
-- Migration 0044: Categorias financeiras, Centros de custo, Formas de
-- pagamento e Condições de pagamento — registros independentes,
-- referenciáveis depois por contas a receber/pagar e faturamento.

CREATE TABLE IF NOT EXISTS categorias_financeiras (
  id                  TEXT PRIMARY KEY,
  tenant_id           TEXT NOT NULL,
  empresa_id          TEXT,
  codigo              TEXT NOT NULL,
  nome                TEXT NOT NULL,
  tipo                TEXT NOT NULL,             -- receita | despesa
  grupo_dre           TEXT,
  categoria_pai_id    TEXT REFERENCES categorias_financeiras(id),
  ativo               INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL,
  updated_at          TEXT,
  created_by          TEXT REFERENCES users(id),
  updated_by          TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_categorias_financeiras_tenant ON categorias_financeiras(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categorias_financeiras_codigo ON categorias_financeiras(tenant_id, codigo);

CREATE TABLE IF NOT EXISTS centros_custo (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  empresa_id    TEXT,
  filial_id     TEXT REFERENCES filiais(id),
  codigo        TEXT NOT NULL,
  nome          TEXT NOT NULL,
  ativo         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT,
  created_by    TEXT REFERENCES users(id),
  updated_by    TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_centros_custo_tenant ON centros_custo(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_centros_custo_codigo ON centros_custo(tenant_id, codigo);

CREATE TABLE IF NOT EXISTS formas_pagamento (
  id                        TEXT PRIMARY KEY,
  tenant_id                 TEXT NOT NULL,
  empresa_id                TEXT,
  codigo                    TEXT NOT NULL,
  nome                      TEXT NOT NULL,
  tipo                      TEXT NOT NULL DEFAULT 'outro',
                            -- dinheiro | cartao_credito | cartao_debito | boleto | pix | transferencia | cheque | outro
  max_parcelas              INTEGER NOT NULL DEFAULT 1,
  taxa_percentual           REAL NOT NULL DEFAULT 0,
  prazo_recebimento_dias    INTEGER NOT NULL DEFAULT 0,
  ativo                     INTEGER NOT NULL DEFAULT 1,
  created_at                TEXT NOT NULL,
  updated_at                TEXT,
  created_by                TEXT REFERENCES users(id),
  updated_by                TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_tenant ON formas_pagamento(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_formas_pagamento_codigo ON formas_pagamento(tenant_id, codigo);

CREATE TABLE IF NOT EXISTS condicoes_pagamento (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  empresa_id    TEXT,
  codigo        TEXT NOT NULL,
  descricao     TEXT NOT NULL,
  ativo         INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT,
  created_by    TEXT REFERENCES users(id),
  updated_by    TEXT REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_condicoes_pagamento_tenant ON condicoes_pagamento(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_condicoes_pagamento_codigo ON condicoes_pagamento(tenant_id, codigo);

CREATE TABLE IF NOT EXISTS condicao_pagamento_parcelas (
  id                      TEXT PRIMARY KEY,
  tenant_id               TEXT NOT NULL,
  condicao_pagamento_id   TEXT NOT NULL REFERENCES condicoes_pagamento(id),
  numero_parcela          INTEGER NOT NULL,
  dias_prazo              INTEGER NOT NULL DEFAULT 0,
  percentual              REAL NOT NULL DEFAULT 0,
  created_at              TEXT NOT NULL,
  updated_at              TEXT
);
CREATE INDEX IF NOT EXISTS idx_condicao_pagamento_parcelas_cond ON condicao_pagamento_parcelas(condicao_pagamento_id);
