import api from './api';

export type InventarioStatus = 'aberto' | 'aplicado' | 'cancelado';

export interface Inventario {
  id: string;
  descricao: string;
  location: string | null;
  status: InventarioStatus;
  data_contagem: string | null;
  num_itens: number;
  created_at: string;
}

export interface InventarioItem {
  id: string;
  produto_id: string;
  produto_descricao: string;
  produto_codigo: string;
  location: string;
  quantidade_sistema: number;
  quantidade_contada: number | null;
}

export const STATUS_LABEL: Record<InventarioStatus, string> = {
  aberto: 'Aberto', aplicado: 'Aplicado', cancelado: 'Cancelado',
};

export const inventariosService = {
  list: async (params: { status?: InventarioStatus } = {}): Promise<Inventario[]> => {
    const r = await api.get('/tenant/estoque/inventarios', { params: { ...params, limit: 200 } });
    return r.data.inventarios ?? [];
  },
  get: async (id: string): Promise<Inventario & { itens: InventarioItem[] }> => {
    const r = await api.get(`/tenant/estoque/inventarios/${id}`);
    return r.data;
  },
  abrir: async (descricao: string, location?: string): Promise<{ id: string; message: string }> => {
    const r = await api.post('/tenant/estoque/inventarios', { descricao, location: location || undefined });
    return r.data;
  },
  salvarContagem: async (inventarioId: string, itemId: string, quantidadeContada: number): Promise<void> => {
    await api.put(`/tenant/estoque/inventarios/${inventarioId}/itens/${itemId}`, { quantidadeContada });
  },
  aplicar: async (id: string): Promise<{ message: string }> => {
    const r = await api.post(`/tenant/estoque/inventarios/${id}/aplicar`);
    return r.data;
  },
  cancelar: async (id: string): Promise<void> => {
    await api.post(`/tenant/estoque/inventarios/${id}/cancelar`);
  },
};
