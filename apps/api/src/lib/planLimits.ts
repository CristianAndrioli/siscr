/** Limites do plano contratado (empresas / filiais / usuários). */

export const DEFAULT_PLAN_ID = 'free'

export type PlanRow = {
  id: string
  nome: string
  max_empresas: number
  max_filiais: number
  max_usuarios: number
  max_docs_fiscais_mes: number
  max_emails_mes: number
  preco_mensal: number
  preco_anual: number
}

export type TenantUsage = {
  empresas: number
  filiais: number
  usuarios: number
}

export async function fetchPlanById(db: D1Database, planId: string): Promise<PlanRow | null> {
  return db
    .prepare(
      `SELECT id, nome, max_empresas, max_filiais, max_usuarios,
              COALESCE(max_docs_fiscais_mes, 0) AS max_docs_fiscais_mes,
              COALESCE(max_emails_mes, 0) AS max_emails_mes,
              preco_mensal, preco_anual
       FROM plans WHERE id = ? AND ativo = 1`,
    )
    .bind(planId)
    .first<PlanRow>()
}

/** Plano efetivo do tenant (fallback `free` se plan_id nulo ou inválido). */
export async function resolvePlanForTenant(db: D1Database, tenantId: string): Promise<PlanRow> {
  const t = await db
    .prepare('SELECT plan_id FROM tenants WHERE id = ?')
    .bind(tenantId)
    .first<{ plan_id: string | null }>()
  const raw = t?.plan_id?.trim() || DEFAULT_PLAN_ID
  let plan = await fetchPlanById(db, raw)
  if (!plan) plan = await fetchPlanById(db, DEFAULT_PLAN_ID)
  if (!plan) {
    return {
      id: DEFAULT_PLAN_ID,
      nome: 'Free',
      max_empresas: 1,
      max_filiais: 1,
      max_usuarios: 2,
      max_docs_fiscais_mes: 0,
      max_emails_mes: 50,
      preco_mensal: 0,
      preco_anual: 0,
    }
  }
  return plan
}

export async function getTenantUsage(db: D1Database, tenantId: string): Promise<TenantUsage> {
  const e = await db
    .prepare('SELECT COUNT(*) AS n FROM empresas WHERE tenant_id = ?')
    .bind(tenantId)
    .first<{ n: number }>()
  const f = await db
    .prepare('SELECT COUNT(*) AS n FROM filiais WHERE tenant_id = ?')
    .bind(tenantId)
    .first<{ n: number }>()
  const u = await db
    .prepare('SELECT COUNT(*) AS n FROM users WHERE tenant_id = ? AND ativo = 1')
    .bind(tenantId)
    .first<{ n: number }>()
  return {
    empresas: e?.n ?? 0,
    filiais: f?.n ?? 0,
    usuarios: u?.n ?? 0,
  }
}

export type PlanLimitCode = 'PLAN_LIMIT_EMPRESAS' | 'PLAN_LIMIT_FILIAIS' | 'PLAN_LIMIT_USUARIOS'

export type PlanLimitBody = {
  error: string
  code: PlanLimitCode
  plan_id: string
  plan_nome: string
  limite: number
  uso_atual: number
  recurso: 'empresas' | 'filiais' | 'usuarios'
  detalhe: string
}

export async function checkCanCreateEmpresa(
  db: D1Database,
  tenantId: string,
): Promise<PlanLimitBody | null> {
  const plan = await resolvePlanForTenant(db, tenantId)
  const uso = (await getTenantUsage(db, tenantId)).empresas
  if (uso >= plan.max_empresas) {
    return {
      error: 'Limite de empresas do plano atingido.',
      code: 'PLAN_LIMIT_EMPRESAS',
      plan_id: plan.id,
      plan_nome: plan.nome,
      limite: plan.max_empresas,
      uso_atual: uso,
      recurso: 'empresas',
      detalhe: `Seu plano "${plan.nome}" permite até ${plan.max_empresas} empresa(s). Faça upgrade para cadastrar mais.`,
    }
  }
  return null
}

export async function checkCanCreateFilial(
  db: D1Database,
  tenantId: string,
): Promise<PlanLimitBody | null> {
  const plan = await resolvePlanForTenant(db, tenantId)
  const uso = (await getTenantUsage(db, tenantId)).filiais
  if (uso >= plan.max_filiais) {
    return {
      error: 'Limite de filiais do plano atingido.',
      code: 'PLAN_LIMIT_FILIAIS',
      plan_id: plan.id,
      plan_nome: plan.nome,
      limite: plan.max_filiais,
      uso_atual: uso,
      recurso: 'filiais',
      detalhe: `Seu plano "${plan.nome}" permite até ${plan.max_filiais} filial(is). Faça upgrade para cadastrar mais.`,
    }
  }
  return null
}

export async function checkCanCreateUsuario(
  db: D1Database,
  tenantId: string,
): Promise<PlanLimitBody | null> {
  const plan = await resolvePlanForTenant(db, tenantId)
  const uso = (await getTenantUsage(db, tenantId)).usuarios
  if (uso >= plan.max_usuarios) {
    return {
      error: 'Limite de usuários do plano atingido.',
      code: 'PLAN_LIMIT_USUARIOS',
      plan_id: plan.id,
      plan_nome: plan.nome,
      limite: plan.max_usuarios,
      uso_atual: uso,
      recurso: 'usuarios',
      detalhe: `Seu plano "${plan.nome}" permite até ${plan.max_usuarios} usuário(s) ativo(s). Faça upgrade ou desative usuários.`,
    }
  }
  return null
}
