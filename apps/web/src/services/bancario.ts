import api from './api';

export interface ContaBancaria {
  id: string;
  nome: string;
  banco_codigo?: string;
  banco_nome?: string;
  agencia?: string;
  conta?: string;
  tipo: 'corrente' | 'poupanca' | 'caixa' | 'investimento';
  saldo_inicial: number;
  saldo_atual: number;
  ativo: number;
}

export interface ContaBancariaForm {
  nome: string;
  banco_codigo?: string;
  banco_nome?: string;
  agencia?: string;
  conta?: string;
  tipo: 'corrente' | 'poupanca' | 'caixa' | 'investimento';
  saldo_inicial: number;
}

export interface MovimentoBancario {
  id: string;
  conta_bancaria_id: string;
  conta_nome?: string;
  tipo: 'credito' | 'debito';
  valor: number;
  data: string;
  descricao?: string;
  origem_tipo?: string;
  origem_id?: string;
}

// ─── Conciliação types ────────────────────────────────────────────

export interface ConciliacaoSessao {
  id: string;
  conta_bancaria_id: string;
  conta_nome?: string;
  banco_nome?: string;
  arquivo_nome?: string;
  data_inicio?: string;
  data_fim?: string;
  saldo_inicial?: number;
  saldo_final?: number;
  total_creditos: number;
  total_debitos: number;
  total_itens: number;
  itens_conciliados: number;
  itens_ignorados: number;
  itens_manuais: number;
  status: string;
  created_at: string;
  created_by?: string;
}

export interface ConciliacaoItem {
  id: string;
  conciliacao_id: string;
  ofx_fitid?: string;
  tipo: 'credito' | 'debito';
  valor: number;
  data: string;
  descricao?: string;
  status: 'conciliado' | 'ignorado' | 'manual';
  movimento_id?: string;
  origem_tipo?: 'contas_receber' | 'contas_pagar';
  origem_id?: string;
}

export interface SugestaoMatch {
  tipo: 'contas_receber' | 'contas_pagar';
  id: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  pessoa_nome?: string;
  score: number;
}

export interface ConciliacaoItemInput {
  ofx_fitid: string;
  tipo: 'credito' | 'debito';
  valor: number;
  data: string;
  descricao?: string;
  acao: 'conciliar' | 'ignorar' | 'manual';
  origem_tipo?: 'contas_receber' | 'contas_pagar';
  origem_id?: string;
}

const BASE = '/tenant/bancario';

export const bancarioService = {
  listContas: async (): Promise<ContaBancaria[]> => {
    const res = await api.get(`${BASE}/contas`);
    return res.data.contas;
  },

  getConta: async (id: string): Promise<ContaBancaria> => {
    const res = await api.get(`${BASE}/contas/${id}`);
    return res.data;
  },

  createConta: async (form: ContaBancariaForm): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/contas`, form);
    return res.data;
  },

  updateConta: async (id: string, form: Partial<ContaBancariaForm>): Promise<void> => {
    await api.put(`${BASE}/contas/${id}`, form);
  },

  deleteConta: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/contas/${id}`);
  },

  listMovimentos: async (params?: {
    contaId?: string;
    dataInicio?: string;
    dataFim?: string;
    tipo?: 'credito' | 'debito';
  }): Promise<MovimentoBancario[]> => {
    const res = await api.get(`${BASE}/movimentos`, { params });
    return res.data.movimentos;
  },

  createMovimento: async (data: {
    conta_bancaria_id: string;
    tipo: 'credito' | 'debito';
    valor: number;
    data: string;
    descricao?: string;
  }): Promise<void> => {
    await api.post(`${BASE}/movimentos`, data);
  },

  getSaldos: async (): Promise<{ contas: ContaBancaria[]; total_disponivel: number }> => {
    const res = await api.get(`${BASE}/saldos`);
    return res.data;
  },

  // ─── Conciliação ──────────────────────────────────────────────

  getSugestoes: async (params: {
    conta_bancaria_id: string;
    transacoes: Array<{ fitid: string; tipo: 'credito' | 'debito'; valor: number; data: string; descricao?: string }>;
  }): Promise<{ sugestoes: Record<string, SugestaoMatch[]>; fitids_duplicados: string[] }> => {
    const res = await api.post(`${BASE}/conciliacoes/sugestoes`, params);
    return res.data;
  },

  listConciliacoes: async (contaId?: string): Promise<ConciliacaoSessao[]> => {
    const res = await api.get(`${BASE}/conciliacoes`, { params: contaId ? { contaId } : undefined });
    return res.data.conciliacoes;
  },

  getConciliacao: async (id: string): Promise<{ session: ConciliacaoSessao; itens: ConciliacaoItem[] }> => {
    const res = await api.get(`${BASE}/conciliacoes/${id}`);
    return res.data;
  },

  criarConciliacao: async (data: {
    conta_bancaria_id: string;
    arquivo_nome?: string;
    data_inicio?: string;
    data_fim?: string;
    saldo_inicial?: number;
    saldo_final?: number;
    itens: ConciliacaoItemInput[];
  }): Promise<{ id: string; total_itens: number; itens_conciliados: number; itens_ignorados: number; itens_manuais: number }> => {
    const res = await api.post(`${BASE}/conciliacoes`, data);
    return res.data;
  },
};
