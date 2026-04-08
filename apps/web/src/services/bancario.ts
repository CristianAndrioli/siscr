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

const BASE = '/api/tenant/bancario';

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
};
