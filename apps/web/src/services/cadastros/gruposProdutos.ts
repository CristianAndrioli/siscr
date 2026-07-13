import api from '../api';

export interface GrupoProduto {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  codigo: string;
  descricao: string;
  grupo_pai_id: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
}

export interface GrupoProdutoForm {
  codigo: string;
  descricao: string;
  grupoPaiId?: string | null;
  empresaId?: string | null;
  ativo?: boolean;
}

export type GruposProdutosListResult = {
  grupos: GrupoProduto[];
  total: number;
  page: number;
  limit: number;
};

function sanitize(dados: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '' && v !== undefined));
}

export const gruposProdutosService = {
  list: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<GruposProdutosListResult> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    const response = await api.get('/tenant/cadastros/grupos-produtos', { params: query });
    const d = response.data;
    return {
      grupos: d.grupos ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },

  create: async (dados: GrupoProdutoForm): Promise<{ id: string; message: string }> => {
    const response = await api.post('/tenant/cadastros/grupos-produtos', sanitize({ ...dados }));
    return response.data;
  },

  update: async (id: string, dados: Partial<GrupoProdutoForm>): Promise<{ message: string }> => {
    const response = await api.put(`/tenant/cadastros/grupos-produtos/${id}`, sanitize({ ...dados }));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/grupos-produtos/${id}`);
  },
};
