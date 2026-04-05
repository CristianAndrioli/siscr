import type { D1Database } from '@cloudflare/workers-types'
import { EmpresaRepository } from '../../repositories/EmpresaRepository'
import { FilialRepository } from '../../repositories/FilialRepository'
import { TenantInfoRepository } from '../../repositories/TenantInfoRepository'
import { EmpresaFilialService } from './EmpresaFilialService'
import { TenantInfoService } from './TenantInfoService'

export function createEmpresaFilialService(db: D1Database, tenantId: string) {
  return new EmpresaFilialService(new EmpresaRepository(db, tenantId), new FilialRepository(db, tenantId))
}

export function createTenantInfoService(db: D1Database, tenantId: string) {
  return new TenantInfoService(new TenantInfoRepository(db, tenantId))
}
