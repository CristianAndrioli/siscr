-- Migration 0056: cotacoes ganha empresa_id (obrigatório) e filial_id (opcional = matriz)
--
-- Banco único no Cloudflare: dados de tenant já são isolados por tenant_id.
-- Dentro do tenant, documentos operacionais também precisam de empresa —
-- e, quando houver, de filial. Sem filial o documento é da matriz.
--
-- Cotação era uma das poucas tabelas ainda sem esse escopo; o Faturar
-- precisava perguntar empresa no wizard. Com estes campos, a NF-e herda.

ALTER TABLE cotacoes ADD COLUMN empresa_id TEXT REFERENCES empresas(id);
ALTER TABLE cotacoes ADD COLUMN filial_id TEXT REFERENCES filiais(id);

-- Backfill: associa à primeira empresa do tenant (a mais antiga).
UPDATE cotacoes
SET empresa_id = (
  SELECT e.id FROM empresas e
  WHERE e.tenant_id = cotacoes.tenant_id
  ORDER BY e.created_at ASC
  LIMIT 1
)
WHERE empresa_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_cotacoes_empresa ON cotacoes(tenant_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_filial ON cotacoes(tenant_id, filial_id);
