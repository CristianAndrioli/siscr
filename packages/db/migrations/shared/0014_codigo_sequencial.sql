-- Migration 0014: Código sequencial por tabela
-- Estratégia: ADD COLUMN codigo INTEGER (nullable) + AFTER INSERT TRIGGER por tenant
-- SQLite AUTOINCREMENT só funciona em INTEGER PRIMARY KEY; para PKs UUID usamos triggers.

-- ─── Pessoas ──────────────────────────────────────────────────────────────────

ALTER TABLE pessoas ADD COLUMN codigo INTEGER;

CREATE TRIGGER trg_pessoas_codigo
AFTER INSERT ON pessoas
WHEN NEW.codigo IS NULL
BEGIN
  UPDATE pessoas
  SET codigo = (SELECT COALESCE(MAX(codigo), 0) + 1 FROM pessoas WHERE tenant_id = NEW.tenant_id)
  WHERE id = NEW.id;
END;

-- backfill: registros existentes recebem o rowid como código (único, não sequencial por tenant)
UPDATE pessoas SET codigo = rowid WHERE codigo IS NULL;

-- ─── Contas a Receber ─────────────────────────────────────────────────────────

ALTER TABLE contas_receber ADD COLUMN codigo INTEGER;

CREATE TRIGGER trg_contas_receber_codigo
AFTER INSERT ON contas_receber
WHEN NEW.codigo IS NULL
BEGIN
  UPDATE contas_receber
  SET codigo = (SELECT COALESCE(MAX(codigo), 0) + 1 FROM contas_receber WHERE tenant_id = NEW.tenant_id)
  WHERE id = NEW.id;
END;

UPDATE contas_receber SET codigo = rowid WHERE codigo IS NULL;

-- ─── Contas a Pagar ───────────────────────────────────────────────────────────

ALTER TABLE contas_pagar ADD COLUMN codigo INTEGER;

CREATE TRIGGER trg_contas_pagar_codigo
AFTER INSERT ON contas_pagar
WHEN NEW.codigo IS NULL
BEGIN
  UPDATE contas_pagar
  SET codigo = (SELECT COALESCE(MAX(codigo), 0) + 1 FROM contas_pagar WHERE tenant_id = NEW.tenant_id)
  WHERE id = NEW.id;
END;

UPDATE contas_pagar SET codigo = rowid WHERE codigo IS NULL;

-- ─── Movimentações de Estoque ─────────────────────────────────────────────────

ALTER TABLE movimentacoes_estoque ADD COLUMN codigo INTEGER;

CREATE TRIGGER trg_movimentacoes_estoque_codigo
AFTER INSERT ON movimentacoes_estoque
WHEN NEW.codigo IS NULL
BEGIN
  UPDATE movimentacoes_estoque
  SET codigo = (SELECT COALESCE(MAX(codigo), 0) + 1 FROM movimentacoes_estoque WHERE tenant_id = NEW.tenant_id)
  WHERE id = NEW.id;
END;

UPDATE movimentacoes_estoque SET codigo = rowid WHERE codigo IS NULL;

-- ─── Locais de Estoque ────────────────────────────────────────────────────────

ALTER TABLE locais ADD COLUMN codigo INTEGER;

CREATE TRIGGER trg_locais_codigo
AFTER INSERT ON locais
WHEN NEW.codigo IS NULL
BEGIN
  UPDATE locais
  SET codigo = (SELECT COALESCE(MAX(codigo), 0) + 1 FROM locais WHERE tenant_id = NEW.tenant_id)
  WHERE id = NEW.id;
END;

UPDATE locais SET codigo = rowid WHERE codigo IS NULL;

-- ─── Produtos ─────────────────────────────────────────────────────────────────
-- A coluna `codigo TEXT NOT NULL` já existe e não pode receber NULL (impossível usar trigger).
-- O backend auto-gera o valor via MAX(CAST(codigo AS INTEGER))+1 antes de cada INSERT.
-- Aqui apenas removemos o índice único antigo e criamos um por tenant (código é por tenant).

DROP INDEX IF EXISTS idx_produtos_codigo_empresa;
CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_codigo_tenant ON produtos(tenant_id, codigo);

-- ─── Serviços ─────────────────────────────────────────────────────────────────
-- Mesma situação: codigo TEXT NOT NULL, gerado pelo backend.

DROP INDEX IF EXISTS idx_servicos_codigo_empresa;
CREATE UNIQUE INDEX IF NOT EXISTS idx_servicos_codigo_tenant ON servicos(tenant_id, codigo);
