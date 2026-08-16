/**
 * Tipos base para o sistema SISCR
 */

// ============================================
// PESSOA
// ============================================
export interface Pessoa {
  codigo_cadastro: number;
  tipo?: 'PF' | 'PJ';
  cpf_cnpj?: string;
  nome_completo?: string;
  razao_social?: string;
  nome_fantasia?: string;
  inscricao_estadual?: string;
  contribuinte?: boolean;
  logradouro?: string;
  numero?: string;
  letra?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  nome_contato?: string;
  telefone_fixo?: string;
  telefone_celular?: string;
  email?: string;
  cargo?: string;
  comissoes?: number;
  observacoes?: string;
}

// ============================================
// PRODUTO
// ============================================
export interface Produto {
  codigo_produto: number;
  nome: string;
  descricao?: string;
  ativo?: boolean;
  valor_custo?: number;
  valor_venda?: number;
  unidade_medida?: 'UN' | 'KG' | 'LT' | 'M2';
  peso_liquido?: number;
  peso_bruto?: number;
  codigo_ncm?: string;
  cfop_interno?: string;
  origem_mercadoria?: '0' | '1' | '2';
  cst_icms?: string;
  aliquota_icms?: number;
  aliquota_ipi?: number;
  codigo_di?: string;
  incoterm?: string;
  moeda_negociacao?: 'BRL' | 'USD' | 'EUR';
  aliquota_ii?: number;
}

// ============================================
// SERVIÇO
// ============================================
export interface Servico {
  codigo_servico: number;
  nome: string;
  descricao?: string;
  ativo?: boolean;
  valor_base: number;
  tipo_contrato?: 'Mensal' | 'Anual' | 'Projeto' | 'Avulso';
  prazo_execucao?: number;
  valor_impostos_estimado?: number;
  codigo_ncm?: string;
  cfop?: string;
  tributacao_pis?: number;
  tributacao_cofins?: number;
  icms_tributado?: boolean;
}

// ============================================
// CONTA A RECEBER
// ============================================
export interface ContaReceber {
  codigo_conta: number;
  numero_documento: string;
  cliente: number;
  cliente_nome?: string;
  valor_total: number;
  valor_recebido: number;
  valor_pendente: number;
  data_emissao: string;
  data_vencimento: string;
  data_recebimento?: string | null;
  status: 'Pendente' | 'Parcial' | 'Pago' | 'Cancelado' | 'Vencido';
  forma_pagamento?: 'Dinheiro' | 'PIX' | 'Boleto' | 'Cartão Crédito' | 'Cartão Débito' | 'Transferência' | 'Cheque';
  descricao?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// CONTA A PAGAR
// ============================================
export interface ContaPagar {
  codigo_conta: number;
  numero_documento: string;
  fornecedor: number;
  fornecedor_nome?: string;
  valor_total: number;
  valor_pago: number;
  valor_pendente: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  status: 'Pendente' | 'Parcial' | 'Pago' | 'Cancelado' | 'Vencido';
  forma_pagamento?: 'Dinheiro' | 'PIX' | 'Boleto' | 'Cartão Crédito' | 'Cartão Débito' | 'Transferência' | 'Cheque';
  descricao?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// PAGINAÇÃO
// ============================================
export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

// ============================================
// FORMULÁRIOS
// ============================================
export interface FormField {
  name: string;
  label?: string;
  type?: 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  readOnly?: boolean;
  defaultValue?: unknown;
  options?: Array<{ value: string | number; label: string }>;
  rows?: number;
  step?: string;
  section?: string;
  fullWidth?: boolean;
  render?: (value: unknown, record?: unknown) => React.ReactNode;
}

// ============================================
// GRID
// ============================================
export interface GridColumn<T = unknown> {
  key: string;
  label: string;
  width?: number;
  required?: boolean;
  fixed?: boolean;
  sortable?: boolean;
  render?: (value: unknown, record?: T) => React.ReactNode;
}

// ============================================
// ERROS
// ============================================
export interface ApiError {
  detail?: string;
  [key: string]: string | string[] | undefined;
}

