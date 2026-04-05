-- =============================================================================
-- Backfill manual: empresa_id e filial_id em registros antigos (D1 / SQLite)
-- =============================================================================
-- NÃO é migração versionada: rode só quando precisar corrigir dados de teste.
--
-- Regras:
--   • empresa “padrão” do tenant = primeira empresas.created_at
--   • filial “padrão” da empresa = primeira filiais.created_at daquela empresa
--   • user_permissions: só preenche empresa_id; filial_id NULL = todas as filiais
--   • Onde der, usa FK lógica (pedido, pessoa, produto) antes do default
--
-- Riscos (leia antes de rodar):
--   • produtos: índice único (codigo, empresa_id) pode conflitar se dois órfãos
--     tiverem o mesmo código e forem para a mesma empresa
--   • estoque: índice único (tenant_id, filial_id, produto_id) pode conflitar
--
-- Execução (ajuste o nome do binding D1):
--   cd apps/api
--   npx wrangler d1 execute siscr-shared-staging --remote --file=../../scripts/d1/manual_backfill_empresa_filial.sql
--   # ou --local para dev
--
-- Opcional: filtrar um tenant (substitua ? e use execute com --command por bloco)
-- =============================================================================

BEGIN TRANSACTION;

-- ─── 1) user_permissions: só empresa (filial NULL mantém “todas as filiais”) ─
UPDATE user_permissions
SET empresa_id = (
  SELECT e.id
  FROM empresas e
  WHERE e.tenant_id = user_permissions.tenant_id
  ORDER BY e.created_at
  LIMIT 1
)
WHERE empresa_id IS NULL;

-- ─── 2) pessoas ────────────────────────────────────────────────────────────
UPDATE pessoas
SET empresa_id = (
  SELECT e.id
  FROM empresas e
  WHERE e.tenant_id = pessoas.tenant_id
  ORDER BY e.created_at
  LIMIT 1
)
WHERE empresa_id IS NULL;

UPDATE pessoas
SET filial_id = (
  SELECT f.id
  FROM filiais f
  WHERE f.tenant_id = pessoas.tenant_id
    AND f.empresa_id = pessoas.empresa_id
  ORDER BY f.created_at
  LIMIT 1
)
WHERE filial_id IS NULL
  AND empresa_id IS NOT NULL;

-- ─── 3) produtos / servicos (só empresa_id) ─────────────────────────────────
UPDATE produtos
SET empresa_id = (
  SELECT e.id
  FROM empresas e
  WHERE e.tenant_id = produtos.tenant_id
  ORDER BY e.created_at
  LIMIT 1
)
WHERE empresa_id IS NULL;

UPDATE servicos
SET empresa_id = (
  SELECT e.id
  FROM empresas e
  WHERE e.tenant_id = servicos.tenant_id
  ORDER BY e.created_at
  LIMIT 1
)
WHERE empresa_id IS NULL;

-- ─── 4) pedidos_venda: tenta empresa pela pessoa (cliente), senão default ───
UPDATE pedidos_venda
SET empresa_id = COALESCE(
  (
    SELECT p.empresa_id
    FROM pessoas p
    WHERE p.id = pedidos_venda.cliente_id
      AND p.tenant_id = pedidos_venda.tenant_id
  ),
  (
    SELECT e.id
    FROM empresas e
    WHERE e.tenant_id = pedidos_venda.tenant_id
    ORDER BY e.created_at
    LIMIT 1
  )
)
WHERE empresa_id IS NULL;

UPDATE pedidos_venda
SET filial_id = (
  SELECT f.id
  FROM filiais f
  WHERE f.tenant_id = pedidos_venda.tenant_id
    AND f.empresa_id = pedidos_venda.empresa_id
  ORDER BY f.created_at
  LIMIT 1
)
WHERE filial_id IS NULL
  AND empresa_id IS NOT NULL;

-- ─── 5) notas_fiscais: herda do pedido quando houver pedido_id ─────────────
UPDATE notas_fiscais
SET
  empresa_id = (SELECT p.empresa_id FROM pedidos_venda p WHERE p.id = notas_fiscais.pedido_id),
  filial_id = (SELECT p.filial_id FROM pedidos_venda p WHERE p.id = notas_fiscais.pedido_id)
WHERE pedido_id IS NOT NULL
  AND (empresa_id IS NULL OR filial_id IS NULL);

UPDATE notas_fiscais
SET empresa_id = (
  SELECT e.id
  FROM empresas e
  WHERE e.tenant_id = notas_fiscais.tenant_id
  ORDER BY e.created_at
  LIMIT 1
)
WHERE empresa_id IS NULL;

UPDATE notas_fiscais
SET filial_id = (
  SELECT f.id
  FROM filiais f
  WHERE f.tenant_id = notas_fiscais.tenant_id
    AND f.empresa_id = notas_fiscais.empresa_id
  ORDER BY f.created_at
  LIMIT 1
)
WHERE filial_id IS NULL
  AND empresa_id IS NOT NULL;

-- ─── 6) contas_*: herda empresa da pessoa, depois filial padrão ──────────────
UPDATE contas_receber
SET empresa_id = (
  SELECT p.empresa_id
  FROM pessoas p
  WHERE p.id = contas_receber.pessoa_id
    AND p.tenant_id = contas_receber.tenant_id
)
WHERE empresa_id IS NULL
  AND pessoa_id IS NOT NULL;

UPDATE contas_receber
SET empresa_id = (
  SELECT e.id
  FROM empresas e
  WHERE e.tenant_id = contas_receber.tenant_id
  ORDER BY e.created_at
  LIMIT 1
)
WHERE empresa_id IS NULL;

UPDATE contas_receber
SET filial_id = (
  SELECT f.id
  FROM filiais f
  WHERE f.tenant_id = contas_receber.tenant_id
    AND f.empresa_id = contas_receber.empresa_id
  ORDER BY f.created_at
  LIMIT 1
)
WHERE filial_id IS NULL
  AND empresa_id IS NOT NULL;

UPDATE contas_pagar
SET empresa_id = (
  SELECT p.empresa_id
  FROM pessoas p
  WHERE p.id = contas_pagar.pessoa_id
    AND p.tenant_id = contas_pagar.tenant_id
)
WHERE empresa_id IS NULL
  AND pessoa_id IS NOT NULL;

UPDATE contas_pagar
SET empresa_id = (
  SELECT e.id
  FROM empresas e
  WHERE e.tenant_id = contas_pagar.tenant_id
  ORDER BY e.created_at
  LIMIT 1
)
WHERE empresa_id IS NULL;

UPDATE contas_pagar
SET filial_id = (
  SELECT f.id
  FROM filiais f
  WHERE f.tenant_id = contas_pagar.tenant_id
    AND f.empresa_id = contas_pagar.empresa_id
  ORDER BY f.created_at
  LIMIT 1
)
WHERE filial_id IS NULL
  AND empresa_id IS NOT NULL;

-- ─── 7) estoque: empresa via produto, senão default tenant ───────────────────
UPDATE estoque
SET empresa_id = (
  SELECT p.empresa_id
  FROM produtos p
  WHERE p.id = estoque.produto_id
    AND p.tenant_id = estoque.tenant_id
)
WHERE empresa_id IS NULL
  AND produto_id IS NOT NULL;

UPDATE estoque
SET empresa_id = (
  SELECT e.id
  FROM empresas e
  WHERE e.tenant_id = estoque.tenant_id
  ORDER BY e.created_at
  LIMIT 1
)
WHERE empresa_id IS NULL;

UPDATE estoque
SET filial_id = (
  SELECT f.id
  FROM filiais f
  WHERE f.tenant_id = estoque.tenant_id
    AND f.empresa_id = estoque.empresa_id
  ORDER BY f.created_at
  LIMIT 1
)
WHERE filial_id IS NULL
  AND empresa_id IS NOT NULL;

-- ─── 8) movimentacoes_estoque ───────────────────────────────────────────────
UPDATE movimentacoes_estoque
SET empresa_id = (
  SELECT p.empresa_id
  FROM produtos p
  WHERE p.id = movimentacoes_estoque.produto_id
    AND p.tenant_id = movimentacoes_estoque.tenant_id
)
WHERE empresa_id IS NULL
  AND produto_id IS NOT NULL;

UPDATE movimentacoes_estoque
SET empresa_id = (
  SELECT e.id
  FROM empresas e
  WHERE e.tenant_id = movimentacoes_estoque.tenant_id
  ORDER BY e.created_at
  LIMIT 1
)
WHERE empresa_id IS NULL;

UPDATE movimentacoes_estoque
SET filial_id = (
  SELECT f.id
  FROM filiais f
  WHERE f.tenant_id = movimentacoes_estoque.tenant_id
    AND f.empresa_id = movimentacoes_estoque.empresa_id
  ORDER BY f.created_at
  LIMIT 1
)
WHERE filial_id IS NULL
  AND empresa_id IS NOT NULL;

COMMIT;

-- Após rodar, confira linhas ainda órfãs (deve retornar 0 em cada):
-- SELECT COUNT(*) FROM pessoas WHERE empresa_id IS NULL;
-- SELECT COUNT(*) FROM produtos WHERE empresa_id IS NULL;
-- SELECT COUNT(*) FROM pedidos_venda WHERE empresa_id IS NULL OR filial_id IS NULL;
-- SELECT COUNT(*) FROM estoque WHERE empresa_id IS NULL OR filial_id IS NULL;
-- SELECT COUNT(*) FROM movimentacoes_estoque WHERE empresa_id IS NULL OR filial_id IS NULL;
-- SELECT COUNT(*) FROM contas_receber WHERE empresa_id IS NULL OR filial_id IS NULL;
-- SELECT COUNT(*) FROM contas_pagar WHERE empresa_id IS NULL OR filial_id IS NULL;
-- SELECT COUNT(*) FROM notas_fiscais WHERE empresa_id IS NULL OR filial_id IS NULL;
