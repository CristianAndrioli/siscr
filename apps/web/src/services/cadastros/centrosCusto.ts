import api from '../api';

export interface CentroCusto {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  codigo: string;
  nome: string;
  filial_id: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
}

export interface CentroCustoForm {
  codigo: string;
  nome: string;
  empresaId?: string | null;
  filialId?: string | null;
  ativo?: boolean;
}

export type CentrosCustoListResult = {
  centros: CentroCusto[];
  total: number;
  page: number;
  limit: number;
};

function sanitize(dados: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '' && v !== undefined));
}

export const centrosCustoService = {
  list: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<CentrosCustoListResult> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    const response = await api.get('/tenant/cadastros/centros-custo', { params: query });
    const d = response.data;
    return {
      centros: d.centros ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },

  create: async (dados: CentroCustoForm): Promise<{ id: string; message: string }> => {
    const response = await api.post('/tenant/cadastros/centros-custo', sanitize({ ...dados }));
    return response.data;
  },

  update: async (id: string, dados: Partial<CentroCustoForm>): Promise<{ message: string }> => {
    const response = await api.put(`/tenant/cadastros/centros-custo/${id}`, sanitize({ ...dados }));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/centros-custo/${id}`);
  },
};
