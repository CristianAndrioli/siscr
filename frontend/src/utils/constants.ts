/**
 * Constantes globais da aplicação
 */

// API
export const API_BASE_URL = '/api';
export const API_TIMEOUT = 30000; // 30 segundos

// Rotas
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  CADASTROS: {
    GERAL: {
      LISTA: '/cadastros/geral/lista',
      NOVO: '/cadastros/geral/novo',
      EDITAR: (codigo: number | string) => `/cadastros/geral/${codigo}/editar`,
    },
    PRODUTOS: {
      LISTA: '/cadastros/produtos/lista',
      NOVO: '/cadastros/produtos/novo',
      EDITAR: (codigo: number | string) => `/cadastros/produtos/${codigo}/editar`,
    },
    SERVICOS: {
      LISTA: '/cadastros/servicos/lista',
      NOVO: '/cadastros/servicos/novo',
      EDITAR: (codigo: number | string) => `/cadastros/servicos/${codigo}/editar`,
    },
  },
} as const;

// Estados brasileiros
export const ESTADOS = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
] as const;

// Tipos de pessoa
export const TIPO_PESSOA = [
  { value: 'PF', label: 'Pessoa Física' },
  { value: 'PJ', label: 'Pessoa Jurídica' },
] as const;

// Tipos de cadastro
export const TIPO_CADASTRO = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'funcionario', label: 'Funcionário' },
] as const;

// Unidades de medida
export const UNIDADE_MEDIDA = [
  { value: 'UN', label: 'Unidade' },
  { value: 'KG', label: 'Kilograma' },
  { value: 'LT', label: 'Litro' },
  { value: 'M2', label: 'Metro Quadrado' },
] as const;

// Tipos de contrato
export const TIPO_CONTRATO = [
  { value: 'Mensal', label: 'Mensal' },
  { value: 'Anual', label: 'Anual' },
  { value: 'Projeto', label: 'Por Projeto' },
  { value: 'Avulso', label: 'Avulso' },
] as const;

// Moedas
export const MOEDAS = [
  { value: 'BRL', label: 'Real (BRL)' },
  { value: 'USD', label: 'Dólar Americano (USD)' },
  { value: 'EUR', label: 'Euro (EUR)' },
] as const;

// Mensagens
export const MESSAGES = {
  SUCCESS: {
    CREATE: 'Registro criado com sucesso!',
    UPDATE: 'Registro atualizado com sucesso!',
    DELETE: 'Registro excluído com sucesso!',
  },
  ERROR: {
    CREATE: 'Erro ao criar registro',
    UPDATE: 'Erro ao atualizar registro',
    DELETE: 'Erro ao excluir registro',
    LOAD: 'Erro ao carregar dados',
    REQUIRED: 'Este campo é obrigatório',
    INVALID: 'Valor inválido',
  },
  CONFIRM: {
    DELETE: 'Tem certeza que deseja excluir este registro?',
  },
} as const;

