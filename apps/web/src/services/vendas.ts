import api from './api';

export type PedidoStatus = 'rascunho' | 'confirmado' | 'faturado' | 'cancelado' | 'entregue';
export type PedidoTipo = 'pedido' | 'orcamento';

export interface PedidoListItem {
  id: string;
  numero: number;
  tipo: PedidoTipo;
  status: PedidoStatus;
  total: number;
  created_at: string;
  cliente: string;
}

export interface Pedido {
  id: string;
  tenant_id: string;
  empresa_id: string;
  /** Nulo quando o pedido é da matriz. */
  filial_id: string | null;
  cliente_id: string;
  vendedor_id: string | null;
  numero: number;
  tipo: PedidoTipo;
  status: PedidoStatus;
  total: number;
  observacoes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PedidoItemRow {
  id: string;
  produto_id: string;
  produto_descricao: string;
  produto_codigo: string;
  quantidade: number;
  preco_unitario: number;
  desconto: number;
  subtotal: number;
}

export interface PedidoItemInput {
  produtoId: string;
  quantidade: number;
  precoUnitario: number;
  desconto: number;
}

export interface PedidoForm {
  empresaId: string;
  /** Omitido quando o pedido é da matriz. */
  filialId?: string;
  clienteId: string;
  vendedorId?: string | null;
  tipo: PedidoTipo;
  observacoes?: string;
  itens: PedidoItemInput[];
}

export const STATUS_LABEL: Record<PedidoStatus, string> = {
  rascunho: 'Rascunho',
  confirmado: 'Confirmado',
  faturado: 'Faturado',
  cancelado: 'Cancelado',
  entregue: 'Entregue',
};

export const vendasService = {
  list: async (params: { status?: PedidoStatus; tipo?: PedidoTipo } = {}): Promise<PedidoListItem[]> => {
    const r = await api.get('/tenant/vendas/pedidos', { params });
    return r.data.pedidos ?? [];
  },

  get: async (id: string): Promise<{ pedido: Pedido; itens: PedidoItemRow[] }> => {
    const r = await api.get(`/tenant/vendas/pedidos/${id}`);
    return r.data;
  },

  create: async (form: PedidoForm): Promise<{ id: string; numero: number; total: number }> => {
    const r = await api.post('/tenant/vendas/pedidos', form);
    return r.data;
  },

  update: async (id: string, form: Partial<PedidoForm>): Promise<void> => {
    await api.patch(`/tenant/vendas/pedidos/${id}`, form);
  },

  updateStatus: async (id: string, status: PedidoStatus, extra?: { vencimentoTitulo?: string; locationEstoque?: string }): Promise<{ message: string }> => {
    const r = await api.patch(`/tenant/vendas/pedidos/${id}/status`, { status, ...extra });
    return r.data;
  },

  converterEmPedido: async (orcamentoId: string): Promise<{ id: string; numero: number }> => {
    const r = await api.post(`/tenant/vendas/pedidos/from-orcamento/${orcamentoId}`);
    return r.data;
  },
};

/** Próximos status possíveis a partir do atual — espelha `transicaoPermitida` em routes/vendas.ts. */
export const PROXIMOS_STATUS: Record<PedidoStatus, PedidoStatus[]> = {
  rascunho: ['confirmado', 'cancelado'],
  confirmado: ['faturado', 'cancelado', 'entregue'],
  entregue: ['faturado', 'cancelado'],
  faturado: ['entregue'],
  cancelado: [],
};
