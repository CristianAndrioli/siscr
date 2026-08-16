-- Planos comerciais 2026: preços, cotas de documentos fiscais/e-mail e Stripe IDs (sandbox).
-- Limites pensados para PME de 1 CNPJ (não licença Salesforce).

ALTER TABLE plans ADD COLUMN max_docs_fiscais_mes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE plans ADD COLUMN max_emails_mes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_tenants_stripe_subscription ON tenants(stripe_subscription_id);

CREATE TABLE IF NOT EXISTS doc_fiscal_emissao_uso (
  tenant_id TEXT NOT NULL,
  ym TEXT NOT NULL,
  qtd INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  PRIMARY KEY (tenant_id, ym)
);

CREATE INDEX IF NOT EXISTS idx_doc_fiscal_emissao_uso_ym ON doc_fiscal_emissao_uso (ym);

INSERT INTO doc_fiscal_emissao_uso (tenant_id, ym, qtd, updated_at)
SELECT tenant_id, ym, qtd, updated_at FROM nfe_emissao_uso
WHERE NOT EXISTS (
  SELECT 1 FROM doc_fiscal_emissao_uso d
  WHERE d.tenant_id = nfe_emissao_uso.tenant_id AND d.ym = nfe_emissao_uso.ym
);

CREATE TABLE IF NOT EXISTS email_envio_uso (
  tenant_id TEXT NOT NULL,
  ym TEXT NOT NULL,
  qtd INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT,
  PRIMARY KEY (tenant_id, ym)
);

-- Free: demo sem NF-e/NFS-e
UPDATE plans SET
  nome = 'Free',
  preco_mensal = 0,
  preco_anual = 0,
  max_empresas = 1,
  max_filiais = 1,
  max_usuarios = 2,
  max_docs_fiscais_mes = 0,
  max_emails_mes = 50,
  stripe_price_id_mensal = NULL,
  stripe_price_id_anual = NULL,
  ativo = 1
WHERE id = 'free';

UPDATE plans SET
  nome = 'Básico',
  preco_mensal = 129,
  preco_anual = 1290,
  max_empresas = 1,
  max_filiais = 2,
  max_usuarios = 5,
  max_docs_fiscais_mes = 50,
  max_emails_mes = 300,
  stripe_price_id_mensal = 'price_1U59stJcxPm9Lx7vQkyftcVw',
  stripe_price_id_anual = 'price_1U59svJcxPm9Lx7v6x7TjFm2',
  ativo = 1
WHERE id = 'basico';

UPDATE plans SET
  nome = 'Pro',
  preco_mensal = 249,
  preco_anual = 2490,
  max_empresas = 1,
  max_filiais = 5,
  max_usuarios = 10,
  max_docs_fiscais_mes = 200,
  max_emails_mes = 1000,
  stripe_price_id_mensal = 'price_1U59swJcxPm9Lx7vDOkPmykQ',
  stripe_price_id_anual = 'price_1U59syJcxPm9Lx7v1twTr1su',
  ativo = 1
WHERE id = 'pro';

UPDATE plans SET
  nome = 'Enterprise',
  preco_mensal = 497,
  preco_anual = 4970,
  max_empresas = 3,
  max_filiais = 15,
  max_usuarios = 25,
  max_docs_fiscais_mes = 1000,
  max_emails_mes = 5000,
  stripe_price_id_mensal = 'price_1U59t0JcxPm9Lx7v0ADoOFfH',
  stripe_price_id_anual = 'price_1U59t0JcxPm9Lx7vMlZdzbZg',
  ativo = 1
WHERE id = 'enterprise';

DELETE FROM plan_caracteristicas WHERE plan_id IN ('free', 'basico', 'pro', 'enterprise');

INSERT INTO plan_caracteristicas (id, plan_id, rotulo, ordem) VALUES
  ('pc_free_1', 'free', '1 empresa', 1),
  ('pc_free_2', 'free', '1 filial', 2),
  ('pc_free_3', 'free', '2 usuários', 3),
  ('pc_free_4', 'free', 'Módulos essenciais (demo)', 4),
  ('pc_free_5', 'free', 'Sem emissão de NF-e / NFS-e', 5),

  ('pc_basico_1', 'basico', '1 empresa', 1),
  ('pc_basico_2', 'basico', '2 filiais', 2),
  ('pc_basico_3', 'basico', '5 usuários', 3),
  ('pc_basico_4', 'basico', '50 documentos fiscais/mês (NF-e + NFS-e)', 4),
  ('pc_basico_5', 'basico', 'Todos os módulos', 5),
  ('pc_basico_6', 'basico', 'Suporte por e-mail', 6),

  ('pc_pro_1', 'pro', '1 empresa', 1),
  ('pc_pro_2', 'pro', '5 filiais', 2),
  ('pc_pro_3', 'pro', '10 usuários', 3),
  ('pc_pro_4', 'pro', '200 documentos fiscais/mês', 4),
  ('pc_pro_5', 'pro', 'Todos os módulos', 5),
  ('pc_pro_6', 'pro', 'Suporte prioritário', 6),

  ('pc_ent_1', 'enterprise', '3 empresas', 1),
  ('pc_ent_2', 'enterprise', '15 filiais', 2),
  ('pc_ent_3', 'enterprise', '25 usuários', 3),
  ('pc_ent_4', 'enterprise', '1.000 documentos fiscais/mês', 4),
  ('pc_ent_5', 'enterprise', 'Todos os módulos', 5),
  ('pc_ent_6', 'enterprise', 'Suporte dedicado', 6);
