/**
 * Cota mensal de emissões NF-e autorizadas (gancho para pacotes comerciais).
 * Incrementa só em autorização SEFAZ com sucesso (cStat 100/150).
 */

import type { Env } from '../../index'

/** Limite default em staging/dev até existir pacote no plano Stripe. */
const DEFAULT_QUOTA = 50

export function currentYm(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function nfeQuotaMensalLimit(env: Env): number {
  const raw = env.NFE_QUOTA_MENSAL?.trim()
  if (raw && /^\d+$/.test(raw)) {
    const n = Number(raw)
    if (n > 0) return n
  }
  return DEFAULT_QUOTA
}

export async function getNfeUsoMes(
  db: D1Database,
  tenantId: string,
  ym = currentYm(),
): Promise<number> {
  const row = await db
    .prepare('SELECT qtd FROM nfe_emissao_uso WHERE tenant_id = ? AND ym = ?')
    .bind(tenantId, ym)
    .first<{ qtd: number }>()
  return row?.qtd ?? 0
}

export async function assertNfeQuotaAvailable(env: Env, tenantId: string): Promise<void> {
  const limit = nfeQuotaMensalLimit(env)
  const used = await getNfeUsoMes(env.DB_SHARED, tenantId)
  if (used >= limit) {
    throw new Error(
      `Cota mensal de NF-e atingida (${used}/${limit}). Aguarde o próximo mês ou amplie o pacote de emissões.`,
    )
  }
}

export async function incrementNfeUsoMes(
  db: D1Database,
  tenantId: string,
  ym = currentYm(),
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO nfe_emissao_uso (tenant_id, ym, qtd, updated_at)
       VALUES (?, ?, 1, datetime('now'))
       ON CONFLICT(tenant_id, ym) DO UPDATE SET
         qtd = qtd + 1,
         updated_at = datetime('now')`,
    )
    .bind(tenantId, ym)
    .run()
  return getNfeUsoMes(db, tenantId, ym)
}
