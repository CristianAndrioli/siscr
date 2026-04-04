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
  produto_id: string;
  produto: string;
  codigo: string;
  tipo: 'entrada' | 'saida' | 'ajuste' | 'transferencia_saida' | 'transferencia_entrada';
  quantidade: number;
  location: string;
  motivo?: string;
  referencia_id?: string;
  created_at: string;
}

export interface Transferencia {
  id: string;
  produto_id: string;
  produto: string;
  codigo: string;
  quantidade: number;
  local_origem: string;
  local_destino: string;
  motivo?: string;
  created_at: string;
}

export interface Local {
  id: string;
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

export const estoqueService = {
  posicao: async (params?: { busca?: string; location?: string }): Promise<ItemEstoque[]> => {
    const res = await api.get(BASE, { params });
    return res.data.estoque ?? [];
  },
};

export const movimentacoesService = {
  list: async (params?: { tipo?: string; busca?: string }): Promise<Movimentacao[]> => {
    const res = await api.get(`${BASE}/movimentacoes`, { params });
    return res.data.movimentacoes ?? [];
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
