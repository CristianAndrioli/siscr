import api from '../api';

export type TabelaPrecoTipoAjuste = 'percentual' | 'fixo';

export interface TabelaPreco {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  nome: string;
  tipo_ajuste: TabelaPrecoTipoAjuste;
  valor_ajuste: number | null;
  vigencia_inicio: string | null;
  vigencia_fim: string | null;
  ativo: number;
  num_itens: number;
  created_at: string;
  updated_at: string;
}

export interface TabelaPrecoForm {
  nome: string;
  tipoAjuste: TabelaPrecoTipoAjuste;
  valorAjuste?: number | null;
  vigenciaInicio?: string | null;
  vigenciaFim?: string | null;
  empresaId?: string | null;
  ativo?: boolean;
}

export type TabelasPrecoListResult = {
  tabelas: TabelaPreco[];
  total: number;
  page: number;
  limit: number;
};

function sanitize(dados: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '' && v !== undefined));
}

export const tabelasPrecoService = {
  list: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<TabelasPrecoListResult> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    const response = await api.get('/tenant/cadastros/tabelas-preco', { params: query });
    const d = response.data;
    return {
      tabelas: d.tabelas ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },

  create: async (dados: TabelaPrecoForm): Promise<{ id: string; message: string }> => {
    const response = await api.post('/tenant/cadastros/tabelas-preco', sanitize({ ...dados }));
    return response.data;
  },

  update: async (id: string, dados: Partial<TabelaPrecoForm>): Promise<{ message: string }> => {
    const response = await api.put(`/tenant/cadastros/tabelas-preco/${id}`, sanitize({ ...dados }));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/tabelas-preco/${id}`);
  },
};
