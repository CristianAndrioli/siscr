import api from '../api';

export type CategoriaFinanceiraTipo = 'receita' | 'despesa';

export interface CategoriaFinanceira {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  codigo: string;
  nome: string;
  tipo: CategoriaFinanceiraTipo;
  grupo_dre: string | null;
  categoria_pai_id: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
}

export interface CategoriaFinanceiraForm {
  codigo: string;
  nome: string;
  tipo: CategoriaFinanceiraTipo;
  grupoDre?: string | null;
  categoriaPaiId?: string | null;
  empresaId?: string | null;
  ativo?: boolean;
}

export type CategoriasFinanceirasListResult = {
  categorias: CategoriaFinanceira[];
  total: number;
  page: number;
  limit: number;
};

function sanitize(dados: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '' && v !== undefined));
}

export const categoriasFinanceirasService = {
  list: async (
    params: { search?: string; tipo?: CategoriaFinanceiraTipo; page?: number; limit?: number } = {},
  ): Promise<CategoriasFinanceirasListResult> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.tipo) query.tipo = params.tipo;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    const response = await api.get('/tenant/cadastros/categorias-financeiras', { params: query });
    const d = response.data;
    return {
      categorias: d.categorias ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },

  create: async (dados: CategoriaFinanceiraForm): Promise<{ id: string; message: string }> => {
    const response = await api.post('/tenant/cadastros/categorias-financeiras', sanitize({ ...dados }));
    return response.data;
  },

  update: async (id: string, dados: Partial<CategoriaFinanceiraForm>): Promise<{ message: string }> => {
    const response = await api.put(`/tenant/cadastros/categorias-financeiras/${id}`, sanitize({ ...dados }));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/categorias-financeiras/${id}`);
  },
};
