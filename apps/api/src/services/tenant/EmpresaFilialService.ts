import { EmpresaRepository, type EmpresaInsertRow } from '../../repositories/EmpresaRepository'
import { FilialRepository, type FilialInsertRow } from '../../repositories/FilialRepository'

const EMPRESA_FIELD_MAP: Record<string, string> = {
  razaoSocial: 'razao_social',
  nomeFantasia: 'nome_fantasia',
  cnpj: 'cnpj',
  inscricaoEstadual: 'inscricao_estadual',
  email: 'email',
  telefone: 'telefone',
  logradouro: 'logradouro',
  numero: 'numero',
  complemento: 'complemento',
  bairro: 'bairro',
  cidade: 'cidade',
  uf: 'uf',
  cep: 'cep',
  codigoMunicipio: 'codigo_municipio',
  crt: 'crt',
  cnae: 'cnae',
  nfeSerie: 'nfe_serie',
  nfeAmbiente: 'nfe_ambiente',
  nfeProximoNumero: 'nfe_proximo_numero',
}

const FILIAL_FIELD_MAP: Record<string, string> = {
  nome: 'nome',
  cnpj: 'cnpj',
  uf: 'uf',
  cidade: 'cidade',
  logradouro: 'logradouro',
  numero: 'numero',
  complemento: 'complemento',
  bairro: 'bairro',
  cep: 'cep',
  codigoMunicipio: 'codigo_municipio',
  inscricaoEstadual: 'inscricao_estadual',
}

export class EmpresaFilialService {
  constructor(
    private readonly empresas: EmpresaRepository,
    private readonly filiais: FilialRepository,
  ) {}

  listEmpresas() {
    return this.empresas.listWithFilialCount()
  }

  async createEmpresa(
    input: {
      razaoSocial: string
      nomeFantasia?: string
      cnpj: string
      inscricaoEstadual?: string
      email?: string
      telefone?: string
      logradouro?: string
      numero?: string
      complemento?: string
      bairro?: string
      cidade?: string
      uf?: string
      cep?: string
      codigoMunicipio?: string
      crt?: string
      cnae?: string
      nfeSerie?: string
      nfeAmbiente?: number
      nfeProximoNumero?: number
    },
    auditUserId: string | null,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const row: EmpresaInsertRow = {
      id,
      razaoSocial: input.razaoSocial,
      nomeFantasia: input.nomeFantasia ?? null,
      cnpj: input.cnpj,
      inscricaoEstadual: input.inscricaoEstadual ?? null,
      email: input.email ?? null,
      telefone: input.telefone ?? null,
      logradouro: input.logradouro ?? null,
      numero: input.numero ?? null,
      complemento: input.complemento ?? null,
      bairro: input.bairro ?? null,
      cidade: input.cidade ?? null,
      uf: input.uf ?? null,
      cep: input.cep ?? null,
      codigoMunicipio: input.codigoMunicipio ?? null,
      crt: input.crt ?? '1',
      cnae: input.cnae ?? null,
      nfeSerie: input.nfeSerie ?? '1',
      nfeAmbiente: input.nfeAmbiente ?? 2,
      nfeProximoNumero: input.nfeProximoNumero ?? 1,
      createdAt: now,
      auditUserId,
    }
    await this.empresas.insert(row)
    return id
  }

  async updateEmpresa(id: string, data: Record<string, unknown>, auditUserId: string | null): Promise<void> {
    const now = new Date().toISOString()
    const fields: string[] = ['updated_at = ?', 'updated_by = ?']
    const vals: unknown[] = [now, auditUserId]
    for (const [k, col] of Object.entries(EMPRESA_FIELD_MAP)) {
      if (data[k] !== undefined) {
        fields.push(`${col} = ?`)
        vals.push(data[k])
      }
    }
    await this.empresas.update(id, fields.join(', '), vals)
  }

  deleteEmpresa(id: string) {
    return this.empresas.delete(id)
  }

  private async ensureEmpresaDoTenant(empresaId: string): Promise<void> {
    const found = await this.empresas.findIdByTenant(empresaId)
    if (!found) {
      const err = new Error('Empresa não encontrada.')
      ;(err as Error & { status: number }).status = 404
      throw err
    }
  }

  async listFiliaisByEmpresa(empresaId: string) {
    await this.ensureEmpresaDoTenant(empresaId)
    return this.filiais.listByEmpresa(empresaId)
  }

  async createFilial(
    empresaId: string,
    input: {
      nome: string
      cnpj?: string
      uf?: string
      cidade?: string
      logradouro?: string
      numero?: string
      complemento?: string
      bairro?: string
      cep?: string
      codigoMunicipio?: string
      inscricaoEstadual?: string
    },
    auditUserId: string | null,
  ): Promise<string> {
    await this.ensureEmpresaDoTenant(empresaId)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const row: FilialInsertRow = {
      id,
      empresaId,
      nome: input.nome,
      cnpj: input.cnpj ?? null,
      uf: input.uf ?? null,
      cidade: input.cidade ?? null,
      logradouro: input.logradouro ?? null,
      numero: input.numero ?? null,
      complemento: input.complemento ?? null,
      bairro: input.bairro ?? null,
      cep: input.cep ?? null,
      codigoMunicipio: input.codigoMunicipio ?? null,
      inscricaoEstadual: input.inscricaoEstadual ?? null,
      ativa: 1,
      createdAt: now,
      auditUserId,
    }
    await this.filiais.insert(row)
    return id
  }

  listAllFiliais() {
    return this.filiais.listAllWithEmpresa()
  }

  async updateFilial(
    id: string,
    data: Record<string, unknown> & { ativa?: boolean },
    auditUserId: string | null,
  ): Promise<void> {
    const now = new Date().toISOString()
    const fields: string[] = ['updated_at = ?', 'updated_by = ?']
    const vals: unknown[] = [now, auditUserId]
    for (const [k, col] of Object.entries(FILIAL_FIELD_MAP)) {
      if (data[k] !== undefined) {
        fields.push(`${col} = ?`)
        vals.push(data[k])
      }
    }
    if (data.ativa !== undefined) {
      fields.push('ativa = ?')
      vals.push(data.ativa ? 1 : 0)
    }
    await this.filiais.update(id, fields.join(', '), vals)
  }

  deleteFilial(id: string) {
    return this.filiais.delete(id)
  }
}
