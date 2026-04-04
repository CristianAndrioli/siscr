-- Adiciona planos basico e pro para alinhar IDs usados na UI e no Stripe
INSERT OR IGNORE INTO plans (id, nome, preco_mensal, preco_anual, max_empresas, max_filiais, max_usuarios, ativo, created_at)
VALUES
  ('basico',     'Básico',     99,   990,  1,   3,   5,  1, datetime('now')),
  ('pro',        'Pro',        199,  1990, 3,   10,  20, 1, datetime('now'));
