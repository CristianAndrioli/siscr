import api from '../api';

export interface CondicaoPagamento {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  codigo: string;
  descricao: string;
  ativo: number;
  num_parcelas: number;
  created_at: string;
  updated_at: string;
}

export interface CondicaoPagamentoForm {
  codigo: string;
  descricao: string;
  empresaId?: string | null;
  ativo?: boolean;
}

export type CondicoesPagamentoListResult = {
  condicoes: CondicaoPagamento[];
  total: number;
  page: number;
  limit: number;
};

function sanitize(dados: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '' && v !== undefined));
}

export const condicoesPagamentoService = {
  list: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<CondicoesPagamentoListResult> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    const response = await api.get('/tenant/cadastros/condicoes-pagamento', { params: query });
    const d = response.data;
    return {
      condicoes: d.condicoes ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },

  create: async (dados: CondicaoPagamentoForm): Promise<{ id: string; message: string }> => {
    const response = await api.post('/tenant/cadastros/condicoes-pagamento', sanitize({ ...dados }));
    return response.data;
  },

  update: async (id: string, dados: Partial<CondicaoPagamentoForm>): Promise<{ message: string }> => {
    const response = await api.put(`/tenant/cadastros/condicoes-pagamento/${id}`, sanitize({ ...dados }));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/condicoes-pagamento/${id}`);
  },
};
