import {
  EmpresaRepository,
  type EmpresaInsertRow,
  type EmpresaUpdateFields,
} from '../../repositories/EmpresaRepository'
import {
  FilialRepository,
  type FilialInsertRow,
  type FilialUpdateFields,
} from '../../repositories/FilialRepository'

/**
 * Regras de negócio para Empresas e Filiais do tenant.
 *
 * Responsabilidade
 * -----------------------------------------------------------------
 * - Validar invariantes entre entidades (ex.: filial só existe se a
 *   empresa pertencer ao tenant).
 * - Coerção de input de API para a "shape" aceita pelo repositório.
 * - Orquestrar operações compostas (create + audit, update com
 *   normalização de booleano, etc.).
 *
 * NÃO é responsabilidade do service
 * -----------------------------------------------------------------
 * - Escrever SQL. (fica no repo)
 * - Ler headers/body de HTTP. (fica na rota)
 */
export class EmpresaFilialService {
  constructor(
    private readonly empresas: EmpresaRepository,
    private readonly filiais: FilialRepository,
  ) {}

  listEmpresas(includeInactive = false) {
    return this.empresas.listWithFilialCount(includeInactive)
  }

  async createEmpresa(
    input: EmpresaCreateInput,
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
      inscricaoMunicipal: input.inscricaoMunicipal ?? null,
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
      nfseSerie: input.nfseSerie ?? '1',
      nfseAmbiente: input.nfseAmbiente ?? 2,
      nfseProximoNumero: input.nfseProximoNumero ?? 1,
      nfseCodigoServicoPadrao: input.nfseCodigoServicoPadrao ?? null,
      createdAt: now,
      auditUserId,
    }
    await this.empresas.insert(row)
    return id
  }

  /**
   * Atualiza campos opcionais da empresa. Retorna `false` se nenhum
   * campo válido foi informado — caller pode responder 400.
   */
  async updateEmpresa(
    id: string,
    patch: EmpresaUpdateFields,
    auditUserId: string | null,
  ): Promise<boolean> {
    return this.empresas.update(id, patch, auditUserId)
  }

  deleteEmpresa(id: string) {
    return this.empresas.delete(id)
  }

  private async ensureEmpresaDoTenant(empresaId: string): Promise<void> {
    const found = await this.empresas.findIdByTenant(empresaId)
    if (!found) {
      const err = new Error('Empresa não encontrada.') as Error & { status: number }
      err.status = 404
      throw err
    }
  }

  async listFiliaisByEmpresa(empresaId: string) {
    await this.ensureEmpresaDoTenant(empresaId)
    return this.filiais.listByEmpresa(empresaId)
  }

  async createFilial(
    empresaId: string,
    input: FilialCreateInput,
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
      inscricaoMunicipal: input.inscricaoMunicipal ?? null,
      ativa: 1,
      createdAt: now,
      auditUserId,
    }
    await this.filiais.insert(row)
    return id
  }

  listAllFiliais(includeInactive = false) {
    return this.filiais.listAllWithEmpresa(includeInactive)
  }

  /**
   * Atualiza a filial normalizando o booleano `ativa` para inteiro.
   * Demais campos são whitelistados no repo.
   */
  async updateFilial(
    id: string,
    input: FilialUpdateInput,
    auditUserId: string | null,
  ): Promise<boolean> {
    const patch: FilialUpdateFields = {
      nome: input.nome,
      cnpj: input.cnpj,
      uf: input.uf,
      cidade: input.cidade,
      logradouro: input.logradouro,
      numero: input.numero,
      complemento: input.complemento,
      bairro: input.bairro,
      cep: input.cep,
      codigoMunicipio: input.codigoMunicipio,
      inscricaoEstadual: input.inscricaoEstadual,
      inscricaoMunicipal: input.inscricaoMunicipal,
    }
    if (input.ativa !== undefined) {
      patch.ativa = input.ativa ? 1 : 0
    }
    return this.filiais.update(id, patch, auditUserId)
  }

  deleteFilial(id: string) {
    return this.filiais.delete(id)
  }
}

// ─── Tipos de entrada (contratos públicos do service) ──────────────

export type EmpresaCreateInput = {
  razaoSocial: string
  nomeFantasia?: string
  cnpj: string
  inscricaoEstadual?: string | null
  inscricaoMunicipal?: string | null
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
  nfseSerie?: string
  nfseAmbiente?: number
  nfseProximoNumero?: number
  nfseCodigoServicoPadrao?: string | null
}

export type FilialCreateInput = {
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
  inscricaoMunicipal?: string
}

export type FilialUpdateInput = FilialUpdateFields & { ativa?: boolean }
