import api from './api';

export type RelatorioFonte = 'financeiro' | 'estoque' | 'vendas' | 'compras';
export type RelatorioPeriodo = '7d' | '30d' | '90d' | '12m';
export type RelatorioVisualizacao = 'tabela' | 'barras' | 'linha' | 'pizza';

export interface FonteColuna {
  label: string;
  type: 'text' | 'number' | 'date';
}

export interface FonteInfo {
  label: string;
  colunas: Record<string, FonteColuna>;
  groupable: string[];
}

export type FontesMap = Record<RelatorioFonte, FonteInfo>;

export interface RelatorioConfig {
  fonte: RelatorioFonte;
  colunas: string[];
  periodo: RelatorioPeriodo;
  agrupamento?: string | null;
  visualizacao: RelatorioVisualizacao;
}

export interface RelatorioQueryResult {
  linhas: Record<string, unknown>[];
  agrupado: boolean;
  total: number | null;
  meta: { fonte: RelatorioFonte; periodo: RelatorioPeriodo; colunas: string[]; agrupamento: string | null; registros: number };
}

export interface RelatorioSalvo {
  id: string;
  nome: string;
  config: RelatorioConfig;
  created_at: string;
  updated_at?: string;
}

export const relatoriosService = {
  fontes: async (): Promise<FontesMap> => {
    const r = await api.get('/tenant/relatorios/fontes');
    return r.data;
  },

  query: async (config: RelatorioConfig): Promise<RelatorioQueryResult> => {
    const r = await api.post('/tenant/relatorios/query', {
      fonte: config.fonte,
      colunas: config.colunas,
      periodo: config.periodo,
      agrupamento: config.agrupamento && config.agrupamento !== 'nenhum' ? config.agrupamento : undefined,
    });
    return r.data;
  },

  listSalvos: async (): Promise<RelatorioSalvo[]> => {
    const r = await api.get('/tenant/relatorios');
    return r.data.relatorios ?? [];
  },

  salvar: async (nome: string, config: RelatorioConfig): Promise<{ id: string }> => {
    const r = await api.post('/tenant/relatorios', { nome, config });
    return r.data;
  },

  remover: async (id: string): Promise<void> => {
    await api.delete(`/tenant/relatorios/${id}`);
  },
};
