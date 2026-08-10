/**
 * Dados de demonstração para cadastros (clientes, fornecedores, produtos, serviços).
 * Marcados com e-mail `@demo.siscr.local` / SKU `DEMO-*` para seed idempotente.
 */

export type DemoPessoa = {
  tipo: 'PF' | 'PJ'
  tipoCadastro: 'cliente' | 'fornecedor' | 'funcionario' | 'transportadora' | 'vendedor'
  nome: string
  cpfCnpj?: string
  email?: string
  telefone?: string
  cep?: string
  logradouro?: string
  numero?: string
  bairro?: string
  cidade?: string
  uf?: string
  codigoMunicipio?: string
}

export type DemoProduto = {
  sku: string
  descricao: string
  unidade: string
  precoVenda: number
  precoCusto?: number
  ncm?: string
}

export type DemoServico = {
  sku: string
  descricao: string
  unidade: string
  preco: number
}

export const DEMO_EMAIL_SUFFIX = '@demo.siscr.local'
export const DEMO_SKU_PREFIX = 'DEMO-'

export const DEMO_PESSOAS: DemoPessoa[] = [
  {
    tipo: 'PJ',
    tipoCadastro: 'cliente',
    nome: 'Alpha Tecnologia Ltda',
    cpfCnpj: '11444777000161',
    email: `alpha${DEMO_EMAIL_SUFFIX}`,
    telefone: '1133334401',
    cep: '01310100',
    logradouro: 'Avenida Paulista',
    numero: '1000',
    bairro: 'Bela Vista',
    cidade: 'São Paulo',
    uf: 'SP',
    codigoMunicipio: '3550308',
  },
  {
    tipo: 'PJ',
    tipoCadastro: 'cliente',
    nome: 'Beta Comércio de Softwares SA',
    cpfCnpj: '04252011000110',
    email: `beta${DEMO_EMAIL_SUFFIX}`,
    telefone: '1144445502',
    cep: '04538132',
    logradouro: 'Rua Funchal',
    numero: '418',
    bairro: 'Vila Olímpia',
    cidade: 'São Paulo',
    uf: 'SP',
    codigoMunicipio: '3550308',
  },
  {
    tipo: 'PF',
    tipoCadastro: 'cliente',
    nome: 'Carla Mendes',
    cpfCnpj: '52998224725',
    email: `carla${DEMO_EMAIL_SUFFIX}`,
    telefone: '11987654321',
    cep: '05422001',
    logradouro: 'Rua Teodoro Sampaio',
    numero: '255',
    bairro: 'Pinheiros',
    cidade: 'São Paulo',
    uf: 'SP',
    codigoMunicipio: '3550308',
  },
  {
    tipo: 'PJ',
    tipoCadastro: 'fornecedor',
    nome: 'Cloud Host Brasil Ltda',
    cpfCnpj: '60746948000112',
    email: `cloudhost${DEMO_EMAIL_SUFFIX}`,
    telefone: '1140012000',
    cep: '06454000',
    logradouro: 'Alameda Rio Negro',
    numero: '500',
    bairro: 'Alphaville',
    cidade: 'Barueri',
    uf: 'SP',
    codigoMunicipio: '3505708',
  },
  {
    tipo: 'PJ',
    tipoCadastro: 'fornecedor',
    nome: 'Office Supplies SP ME',
    cpfCnpj: '34028316000103',
    email: `office${DEMO_EMAIL_SUFFIX}`,
    telefone: '1122223333',
    cep: '01153000',
    logradouro: 'Rua Santa Ifigênia',
    numero: '50',
    bairro: 'Santa Ifigênia',
    cidade: 'São Paulo',
    uf: 'SP',
    codigoMunicipio: '3550308',
  },
  {
    tipo: 'PJ',
    tipoCadastro: 'transportadora',
    nome: 'Rápido Logística Express Ltda',
    cpfCnpj: '00000000000191',
    email: `rapido${DEMO_EMAIL_SUFFIX}`,
    telefone: '1130304040',
    cep: '07112000',
    logradouro: 'Avenida Otaviano Alves de Lima',
    numero: '4800',
    bairro: 'Pirituba',
    cidade: 'São Paulo',
    uf: 'SP',
    codigoMunicipio: '3550308',
  },
  {
    tipo: 'PF',
    tipoCadastro: 'vendedor',
    nome: 'Diego Oliveira',
    cpfCnpj: '39053344705',
    email: `diego${DEMO_EMAIL_SUFFIX}`,
    telefone: '11970001122',
    cidade: 'São Paulo',
    uf: 'SP',
    codigoMunicipio: '3550308',
  },
]

export const DEMO_PRODUTOS: DemoProduto[] = [
  {
    sku: `${DEMO_SKU_PREFIX}NB-I5`,
    descricao: 'Notebook 15" Intel i5 16GB 512SSD',
    unidade: 'UN',
    precoVenda: 4299.9,
    precoCusto: 3400,
    ncm: '84713012',
  },
  {
    sku: `${DEMO_SKU_PREFIX}MON-27`,
    descricao: 'Monitor LED 27" Full HD',
    unidade: 'UN',
    precoVenda: 1199,
    precoCusto: 850,
    ncm: '85285210',
  },
  {
    sku: `${DEMO_SKU_PREFIX}LIC-OFF`,
    descricao: 'Licença Office anual (1 usuário)',
    unidade: 'UN',
    precoVenda: 499,
    precoCusto: 320,
    ncm: '85234990',
  },
  {
    sku: `${DEMO_SKU_PREFIX}CAB-USB`,
    descricao: 'Cabo USB-C 2m',
    unidade: 'UN',
    precoVenda: 49.9,
    precoCusto: 18,
    ncm: '85444200',
  },
]

export const DEMO_SERVICOS: DemoServico[] = [
  {
    sku: `${DEMO_SKU_PREFIX}DEV-HR`,
    descricao: 'Desenvolvimento de software sob demanda (hora)',
    unidade: 'HR',
    preco: 220,
  },
  {
    sku: `${DEMO_SKU_PREFIX}SUP-MES`,
    descricao: 'Suporte técnico mensal — pacote básico',
    unidade: 'UN',
    preco: 890,
  },
  {
    sku: `${DEMO_SKU_PREFIX}CONS-DIA`,
    descricao: 'Consultoria em sistemas e processos (diária)',
    unidade: 'UN',
    preco: 1800,
  },
  {
    sku: `${DEMO_SKU_PREFIX}IMPL-ERP`,
    descricao: 'Implantação e parametrização de ERP',
    unidade: 'UN',
    preco: 12500,
  },
]
