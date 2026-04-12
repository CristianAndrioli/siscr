import api from './api';

export interface ContaReceber {
  id: string;
  codigo?: number;
  descricao: string;
  valor: number;
  vencimento: string;
  status: 'pendente' | 'pago' | 'cancelado';
  categoria?: string;
  observacoes?: string;
  data_pagamento?: string;
  valor_pago?: number;
  pessoa_id: string;
  cliente?: string;
  created_at: string;
  // Issue #8
  nr_documento?: string;
  especie?: string;
  data_emissao?: string;
  data_lancamento?: string;
  moeda?: string;
  parcela?: number;
  total_parcelas?: number;
  nota_fiscal_id?: string;
}

export interface ContaPagar {
  id: string;
  codigo?: number;
  descricao: string;
  valor: number;
  vencimento: string;
  status: 'pendente' | 'pago' | 'cancelado';
  categoria?: string;
  observacoes?: string;
  data_pagamento?: string;
  valor_pago?: number;
  pessoa_id: string;
  fornecedor?: string;
  created_at: string;
  // Issue #8
  nr_documento?: string;
  especie?: string;
  data_emissao?: string;
  data_lancamento?: string;
  moeda?: string;
}

export interface ContaForm {
  pessoaId: string;
  descricao: string;
  valor: number;
  vencimento: string;
  categoria?: string;
  observacoes?: string;
  // Issue #8
  nr_documento?: string;
  especie?: string;
  data_emissao?: string;
  data_lancamento?: string;
  moeda?: string;
}

export interface DashboardData {
  receber: {
    total: number;
    pendente: number;
    recebido: number;
    vencido: number;
    qtd_vencido: number;
  };
  pagar: {
    total: number;
    pendente: number;
    pago: number;
    vencido: number;
    qtd_vencido: number;
  };
  proximosVencimentosCR: { id: string; descricao: string; valor: number; vencimento: string; cliente: string }[];
  proximosVencimentosCP: { id: string; descricao: string; valor: number; vencimento: string; fornecedor: string }[];
  contas_bancarias: { id: string; nome: string; tipo: string; banco_nome?: string; saldo_atual: number }[];
  total_disponivel: number;
}

const BASE = '/tenant/financeiro';

export type ContasListPage = {
  contas: ContaReceber[];
  total: number;
  page: number;
  limit: number;
};

export type ContasPagarListPage = {
  contas: ContaPagar[];
  total: number;
  page: number;
  limit: number;
};

export const contasReceberService = {
  list: async (params?: { status?: string; page?: number; limit?: number }): Promise<ContasListPage> => {
    const res = await api.get(`${BASE}/receber`, { params });
    const d = res.data;
    return {
      contas: d.contas ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },
  get: async (id: string): Promise<ContaReceber> => {
    const res = await api.get(`${BASE}/receber/${id}`);
    return res.data;
  },
  create: async (data: ContaForm): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/receber`, data);
    return res.data;
  },
  update: async (id: string, data: Partial<ContaForm>): Promise<void> => {
    await api.put(`${BASE}/receber/${id}`, data);
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/receber/${id}`);
  },
  marcarPago: async (id: string, dataPagamento: string, valorPago: number, contaBancariaId?: string): Promise<void> => {
    await api.patch(`${BASE}/receber/${id}/pagar`, { dataPagamento, valorPago, contaBancariaId });
  },
};

export const contasPagarService = {
  list: async (params?: { status?: string; page?: number; limit?: number }): Promise<ContasPagarListPage> => {
    const res = await api.get(`${BASE}/pagar`, { params });
    const d = res.data;
    return {
      contas: d.contas ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },
  get: async (id: string): Promise<ContaPagar> => {
    const res = await api.get(`${BASE}/pagar/${id}`);
    return res.data;
  },
  create: async (data: ContaForm): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/pagar`, data);
    return res.data;
  },
  update: async (id: string, data: Partial<ContaForm>): Promise<void> => {
    await api.put(`${BASE}/pagar/${id}`, data);
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/pagar/${id}`);
  },
  marcarPago: async (id: string, dataPagamento: string, valorPago: number, contaBancariaId?: string): Promise<void> => {
    await api.patch(`${BASE}/pagar/${id}/pagar`, { dataPagamento, valorPago, contaBancariaId });
  },
};

export const financeiroService = {
  dashboard: async (): Promise<DashboardData> => {
    const res = await api.get(`${BASE}/dashboard`);
    return res.data;
  },
};
