import api from './api';

export type PedidoCompraStatus = 'rascunho' | 'confirmado' | 'recebido_parcial' | 'recebido' | 'cancelado';

export interface PedidoCompraListItem {
  id: string;
  numero: number;
  status: PedidoCompraStatus;
  total: number;
  created_at: string;
  fornecedor: string;
  fornecedor_id?: string;
}

export interface PedidoCompra {
  id: string;
  tenant_id: string;
  empresa_id: string;
  /** Nulo quando o pedido é da matriz. */
  filial_id: string | null;
  fornecedor_id: string;
  numero: number;
  status: PedidoCompraStatus;
  total: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ItemPedidoCompraRow {
  id: string;
  produto_id: string;
  produto_descricao: string;
  produto_codigo: string;
  quantidade: number;
  quantidade_recebida: number;
  preco_unitario: number;
  subtotal: number;
}

export interface ItemPedidoCompraInput {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
}

export interface PedidoCompraForm {
  empresaId: string;
  /** Omitido quando o pedido é da matriz. */
  filialId?: string;
  fornecedorId: string;
  observacoes?: string;
  itens: ItemPedidoCompraInput[];
}

export interface RecebimentoItemRow {
  id: string;
  item_pedido_id: string;
  quantidade: number;
  produto_descricao: string;
  produto_codigo: string;
}

export interface Recebimento {
  id: string;
  pedido_id: string;
  location: string;
  observacoes: string | null;
  created_at: string;
  itens: RecebimentoItemRow[];
}

export const STATUS_LABEL: Record<PedidoCompraStatus, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  recebido_parcial: 'Recebido parcialmente',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
};

/** Próximas transições manuais de status — espelha `transicaoPermitida` em routes/compras.ts. */
export const PROXIMOS_STATUS: Record<PedidoCompraStatus, PedidoCompraStatus[]> = {
  rascunho: ['confirmado', 'cancelado'],
  confirmado: ['cancelado'],
  recebido_parcial: [],
  recebido: [],
  cancelado: [],
};

export const comprasService = {
  list: async (params: {
    status?: PedidoCompraStatus;
    empresaId?: string;
    filialId?: string;
    fornecedorId?: string;
  } = {}): Promise<PedidoCompraListItem[]> => {
    const r = await api.get('/tenant/compras/pedidos', { params });
    return r.data.pedidos ?? [];
  },

  get: async (id: string): Promise<{ pedido: PedidoCompra; itens: ItemPedidoCompraRow[] }> => {
    const r = await api.get(`/tenant/compras/pedidos/${id}`);
    return r.data;
  },

  create: async (form: PedidoCompraForm): Promise<{ id: string; numero: number; total: number }> => {
    const r = await api.post('/tenant/compras/pedidos', form);
    return r.data;
  },

  update: async (id: string, form: Partial<PedidoCompraForm>): Promise<void> => {
    await api.patch(`/tenant/compras/pedidos/${id}`, form);
  },

  updateStatus: async (id: string, status: PedidoCompraStatus): Promise<{ message: string }> => {
    const r = await api.patch(`/tenant/compras/pedidos/${id}/status`, { status });
    return r.data;
  },

  listRecebimentos: async (id: string): Promise<Recebimento[]> => {
    const r = await api.get(`/tenant/compras/pedidos/${id}/recebimentos`);
    return r.data.recebimentos ?? [];
  },

  registrarRecebimento: async (
    id: string,
    data: { location: string; observacoes?: string; itens: { itemPedidoId: string; quantidade: number }[] },
  ): Promise<{ id: string; status: PedidoCompraStatus }> => {
    const r = await api.post(`/tenant/compras/pedidos/${id}/recebimentos`, data);
    return r.data;
  },
};
