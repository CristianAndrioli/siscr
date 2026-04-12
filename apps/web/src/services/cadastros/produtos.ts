import api from '../api';

export interface Produto {
  id: string;
  codigo: string;
  sku?: string;
  descricao: string;
  unidade: string;
  preco_venda: number;
  preco_custo?: number;
  ncm?: string;
  origem?: number | null;
  cest?: string | null;
  icms_cst?: string | null;
  icms_csosn?: string | null;
  pis_cst?: string | null;
  cofins_cst?: string | null;
  ativo: number;
}

export interface ProdutoForm {
  sku?: string;
  descricao: string;
  unidade: string;
  precoVenda: number;
  precoCusto?: number;
  ncm?: string;
  origem?: number;
  cest?: string;
  icmsCst?: string;
  icmsCsosn?: string;
  pisCst?: string;
  cofinsCst?: string;
  ativo: boolean;
}

function sanitize(dados: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== ''));
}

export const produtosService = {
  list: async (params: { search?: string; page?: number } = {}): Promise<Produto[]> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page) query.page = params.page;
    const response = await api.get('/tenant/cadastros/produtos', { params: query });
    return response.data.produtos ?? [];
  },

  get: async (id: string): Promise<Produto> => {
    const response = await api.get(`/tenant/cadastros/produtos/${id}`);
    return response.data;
  },

  create: async (dados: ProdutoForm): Promise<{ id: string }> => {
    const response = await api.post('/tenant/cadastros/produtos', sanitize({ ...dados }));
    return response.data;
  },

  update: async (id: string, dados: Partial<ProdutoForm>): Promise<void> => {
    await api.put(`/tenant/cadastros/produtos/${id}`, sanitize({ ...dados }));
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/produtos/${id}`);
  },
};
