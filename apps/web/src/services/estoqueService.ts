import api from './api';

export interface ItemEstoque {
  id: string;
  produto_id: string;
  produto: string;
  codigo: string;
  unidade: string;
  location: string;
  quantidade: number;
  updated_at: string;
}

export interface Movimentacao {
  id: string;
  codigo?: number;
  produto_id: string;
  produto: string;
  produto_codigo: string;
  tipo: 'entrada' | 'saida' | 'ajuste' | 'transferencia_saida' | 'transferencia_entrada';
  quantidade: number;
  location: string;
  motivo?: string;
  referencia_id?: string;
  created_at: string;
}

export interface Transferencia {
  id: string;
  codigo?: number;
  produto_id: string;
  produto: string;
  produto_codigo: string;
  quantidade: number;
  local_origem: string;
  local_destino: string;
  motivo?: string;
  created_at: string;
}

export interface Local {
  id: string;
  codigo?: number;
  tenant_id: string;
  nome: string;
  tipo: string;
  descricao?: string;
  ativo: number;
  created_at: string;
  updated_at?: string;
}

export interface MovForm {
  produtoId: string;
  tipo: 'entrada' | 'saida' | 'ajuste';
  quantidade: number;
  location: string;
  motivo?: string;
}

export interface TransForm {
  produtoId: string;
  localOrigem: string;
  localDestino: string;
  quantidade: number;
  motivo?: string;
}

export interface LocalForm {
  nome: string;
  tipo: string;
  descricao?: string;
}

const BASE = '/tenant/estoque';

export interface EstoqueListMeta {
  com_saldo: number;
  zerados: number;
  locais: number;
}

export interface EstoquePosicaoPage {
  estoque: ItemEstoque[];
  total: number;
  page: number;
  limit: number;
  meta: EstoqueListMeta;
}

export const estoqueService = {
  /** Lista paginada (predefinição 10 por página na API). */
  posicao: async (params?: {
    busca?: string;
    location?: string;
    page?: number;
    limit?: number;
  }): Promise<EstoquePosicaoPage> => {
    const res = await api.get(BASE, { params });
    const d = res.data;
    return {
      estoque: d.estoque ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
      meta: {
        com_saldo: Number(d.meta?.com_saldo ?? 0),
        zerados: Number(d.meta?.zerados ?? 0),
        locais: Number(d.meta?.locais ?? 0),
      },
    };
  },

  locaisDistinct: async (): Promise<string[]> => {
    const res = await api.get(`${BASE}/locais-distinct`);
    return res.data.locais ?? [];
  },
};

export interface MovimentacoesListPage {
  movimentacoes: Movimentacao[];
  total: number;
  page: number;
  limit: number;
}

export const movimentacoesService = {
  list: async (params?: { tipo?: string; busca?: string; page?: number; limit?: number }): Promise<MovimentacoesListPage> => {
    const res = await api.get(`${BASE}/movimentacoes`, { params });
    const d = res.data;
    return {
      movimentacoes: d.movimentacoes ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },
  create: async (data: MovForm): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/movimentacoes`, data);
    return res.data;
  },
};

export const transferenciasService = {
  list: async (params?: { busca?: string }): Promise<Transferencia[]> => {
    const res = await api.get(`${BASE}/transferencias`, { params });
    return res.data.transferencias ?? [];
  },
  create: async (data: TransForm): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/transferencias`, data);
    return res.data;
  },
};

export const locaisService = {
  list: async (): Promise<Local[]> => {
    const res = await api.get(`${BASE}/locais`);
    return res.data.locais ?? [];
  },
  create: async (data: LocalForm): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/locais`, data);
    return res.data;
  },
  update: async (id: string, data: Partial<LocalForm>): Promise<void> => {
    await api.put(`${BASE}/locais/${id}`, data);
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/locais/${id}`);
  },
};
