import { TenantInfoRepository } from '../../repositories/TenantInfoRepository'

export class TenantInfoService {
  constructor(private readonly tenantInfo: TenantInfoRepository) {}

  getTenant() {
    return this.tenantInfo.getTenantRow()
  }
}
