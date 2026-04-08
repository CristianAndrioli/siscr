-- Migration 0018: desativa planos legados (starter, business) e ajusta enterprise
-- Mantém apenas: free (demo), basico, pro, enterprise
UPDATE plans SET ativo = 0 WHERE id IN ('starter', 'business');

-- Garante que os 4 planos canônicos estão corretos
UPDATE plans SET
  nome = 'Básico',
  preco_mensal = 99,
  preco_anual = 990,
  max_empresas = 1,
  max_filiais = 3,
  max_usuarios = 5,
  ativo = 1
WHERE id = 'basico';

UPDATE plans SET
  nome = 'Pro',
  preco_mensal = 249,
  preco_anual = 2490,
  max_empresas = 3,
  max_filiais = 10,
  max_usuarios = 20,
  ativo = 1
WHERE id = 'pro';

UPDATE plans SET
  nome = 'Enterprise',
  preco_mensal = 499,
  preco_anual = 4990,
  max_empresas = 99,
  max_filiais = 999,
  max_usuarios = 999,
  ativo = 1
WHERE id = 'enterprise';

UPDATE plans SET
  nome = 'Free',
  preco_mensal = 0,
  preco_anual = 0,
  max_empresas = 1,
  max_filiais = 2,
  max_usuarios = 3,
  ativo = 1
WHERE id = 'free';
