import type { D1Database } from '@cloudflare/workers-types'

/**
 * Base para repositórios que sempre escopam dados por `tenant_id`.
 * Subclasses recebem `db` + `tenantId` e concentram SQL D1.
 */
export abstract class BaseTenantRepository {
  constructor(
    protected readonly db: D1Database,
    protected readonly tenantId: string,
  ) {}

  protected get tenant(): string {
    return this.tenantId
  }
}
