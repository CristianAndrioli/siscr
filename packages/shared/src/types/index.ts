// Tipos compartilhados entre frontend (apps/web) e backend (apps/api)

export type TenantStatus = 'active' | 'suspended' | 'cancelled'
export type UserRole = 'admin' | 'manager' | 'user' | 'readonly'
export type PessoaTipo = 'PF' | 'PJ'
export type TipoCadastro = 'cliente' | 'fornecedor' | 'funcionario' | 'transportadora'
export type MovimentacaoTipo = 'entrada' | 'saida' | 'transferencia' | 'ajuste'
export type PedidoStatus = 'rascunho' | 'confirmado' | 'faturado' | 'cancelado' | 'entregue'
export type PedidoTipo = 'pedido' | 'orcamento'
export type ContaStatus = 'pendente' | 'pago' | 'cancelado'
export type NotaFiscalTipo = 'NFe' | 'NFSe' | 'NFCe'
export type NotaFiscalStatus = 'rascunho' | 'emitida' | 'cancelada' | 'denegada'

export interface Tenant {
  id: string
  slug: string
  nome: string
  planId: string
  status: TenantStatus
  createdAt: string
}

export interface User {
  id: string
  email: string
  nome: string
  role: UserRole
  tenantId: string
}

export interface Empresa {
  id: string
  tenantId: string
  razaoSocial: string
  nomeFantasia?: string
  cnpj: string
  uf?: string
  cidade?: string
}

export interface Filial {
  id: string
  tenantId: string
  empresaId: string
  nome: string
  cnpj?: string
  uf?: string
  cidade?: string
  ativa: boolean
}

export interface Pessoa {
  id: string
  tipo: PessoaTipo
  tipoCadastro: TipoCadastro
  nome: string
  cpfCnpj: string
  email?: string
  telefone?: string
  ativo: boolean
}

export interface Produto {
  id: string
  codigo: string
  descricao: string
  unidade: string
  precoVenda: number
  precoCusto?: number
  ncm?: string
  ativo: boolean
}

export interface PedidoVenda {
  id: string
  numero: number
  tipo: PedidoTipo
  status: PedidoStatus
  total: number
  clienteId: string
  createdAt: string
}

export interface ContaFinanceira {
  id: string
  descricao: string
  valor: number
  vencimento: string
  status: ContaStatus
  pessoaId: string
}

// Tipos de resposta da API
export interface ApiResponse<T> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
