/** Cota mensal de documentos fiscais (NF-e + NFS-e autorizados) por plano. */

import { resolvePlanForTenant } from './planLimits'

export function currentYm(d = new Date()): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export class FiscalQuotaExceededError extends Error {
  readonly code = 'FISCAL_QUOTA_EXCEEDED'
  constructor(
    readonly used: number,
    readonly limit: number,
  ) {
    super(
      `Cota mensal de documentos fiscais atingida (${used}/${limit}). Aguarde o próximo mês ou faça upgrade.`,
    )
    this.name = 'FiscalQuotaExceededError'
  }
}

export async function getFiscalDocUsoMes(
  db: D1Database,
  tenantId: string,
  ym = currentYm(),
): Promise<number> {
  const row = await db
    .prepare('SELECT qtd FROM doc_fiscal_emissao_uso WHERE tenant_id = ? AND ym = ?')
    .bind(tenantId, ym)
    .first<{ qtd: number }>()
  return row?.qtd ?? 0
}

export async function fiscalDocLimitForTenant(db: D1Database, tenantId: string): Promise<number> {
  const plan = await resolvePlanForTenant(db, tenantId)
  return Math.max(0, plan.max_docs_fiscais_mes)
}

export async function assertFiscalDocQuotaAvailable(db: D1Database, tenantId: string): Promise<void> {
  const limit = await fiscalDocLimitForTenant(db, tenantId)
  const used = await getFiscalDocUsoMes(db, tenantId)
  if (used >= limit) {
    throw new FiscalQuotaExceededError(used, limit)
  }
}

export async function incrementFiscalDocUsoMes(
  db: D1Database,
  tenantId: string,
  ym = currentYm(),
): Promise<number> {
  await db
    .prepare(
      `INSERT INTO doc_fiscal_emissao_uso (tenant_id, ym, qtd, updated_at)
       VALUES (?, ?, 1, datetime('now'))
       ON CONFLICT(tenant_id, ym) DO UPDATE SET
         qtd = qtd + 1,
         updated_at = datetime('now')`,
    )
    .bind(tenantId, ym)
    .run()
  return getFiscalDocUsoMes(db, tenantId, ym)
}
