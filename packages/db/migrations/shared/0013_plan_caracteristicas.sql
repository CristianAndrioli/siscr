-- Itens exibidos na página de planos / assinatura (editáveis sem deploy de código).
-- Limites numéricos continuam em plans.max_* (fonte da verdade para enforcement).

CREATE TABLE IF NOT EXISTS plan_caracteristicas (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  rotulo TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_plan_caracteristicas_plan ON plan_caracteristicas(plan_id);

INSERT OR IGNORE INTO plan_caracteristicas (id, plan_id, rotulo, ordem) VALUES
  ('pc_free_1', 'free', '1 empresa', 1),
  ('pc_free_2', 'free', '2 filiais', 2),
  ('pc_free_3', 'free', '3 usuários', 3),
  ('pc_free_4', 'free', 'Módulos essenciais', 4),
  ('pc_free_5', 'free', 'Suporte via comunidade', 5),

  ('pc_basico_1', 'basico', '1 empresa', 1),
  ('pc_basico_2', 'basico', '3 filiais', 2),
  ('pc_basico_3', 'basico', '5 usuários', 3),
  ('pc_basico_4', 'basico', 'Todos os módulos', 4),
  ('pc_basico_5', 'basico', 'Suporte por e-mail', 5),

  ('pc_pro_1', 'pro', '3 empresas', 1),
  ('pc_pro_2', 'pro', '10 filiais', 2),
  ('pc_pro_3', 'pro', '20 usuários', 3),
  ('pc_pro_4', 'pro', 'Todos os módulos', 4),
  ('pc_pro_5', 'pro', 'Suporte prioritário', 5),

  ('pc_ent_1', 'enterprise', 'Até 99 empresas', 1),
  ('pc_ent_2', 'enterprise', 'Até 999 filiais', 2),
  ('pc_ent_3', 'enterprise', 'Até 999 usuários', 3),
  ('pc_ent_4', 'enterprise', 'Todos os módulos', 4),
  ('pc_ent_5', 'enterprise', 'Suporte dedicado', 5);
