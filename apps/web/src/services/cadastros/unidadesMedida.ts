import api from '../api';

export interface UnidadeMedida {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  sigla: string;
  descricao: string;
  fator_conversao: number;
  ativo: number;
  created_at: string;
  updated_at: string;
}

export interface UnidadeMedidaForm {
  sigla: string;
  descricao: string;
  fatorConversao?: number;
  empresaId?: string | null;
  ativo?: boolean;
}

export type UnidadesMedidaListResult = {
  unidades: UnidadeMedida[];
  total: number;
  page: number;
  limit: number;
};

function sanitize(dados: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '' && v !== undefined));
}

export const unidadesMedidaService = {
  list: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<UnidadesMedidaListResult> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    const response = await api.get('/tenant/cadastros/unidades-medida', { params: query });
    const d = response.data;
    return {
      unidades: d.unidades ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },

  create: async (dados: UnidadeMedidaForm): Promise<{ id: string; message: string }> => {
    const response = await api.post('/tenant/cadastros/unidades-medida', sanitize({ ...dados }));
    return response.data;
  },

  update: async (id: string, dados: Partial<UnidadeMedidaForm>): Promise<{ message: string }> => {
    const response = await api.put(`/tenant/cadastros/unidades-medida/${id}`, sanitize({ ...dados }));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/unidades-medida/${id}`);
  },
};
