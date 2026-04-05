import type { D1Database } from '@cloudflare/workers-types'
import { BaseTenantRepository } from './BaseTenantRepository'

export class TenantInfoRepository extends BaseTenantRepository {
  constructor(db: D1Database, tenantId: string) {
    super(db, tenantId)
  }

  async getTenantRow(): Promise<Record<string, unknown> | null> {
    return this.db
      .prepare('SELECT id, slug, nome, plan_id, status, created_at FROM tenants WHERE id = ?')
      .bind(this.tenantId)
      .first<Record<string, unknown>>()
  }
}
