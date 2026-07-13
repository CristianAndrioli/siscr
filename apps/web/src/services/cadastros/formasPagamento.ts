import api from '../api';

export type FormaPagamentoTipo =
  | 'dinheiro'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'boleto'
  | 'pix'
  | 'transferencia'
  | 'cheque'
  | 'outro';

export interface FormaPagamento {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  codigo: string;
  nome: string;
  tipo: FormaPagamentoTipo;
  max_parcelas: number | null;
  taxa_percentual: number | null;
  prazo_recebimento_dias: number | null;
  ativo: number;
  created_at: string;
  updated_at: string;
}

export interface FormaPagamentoForm {
  codigo: string;
  nome: string;
  tipo: FormaPagamentoTipo;
  maxParcelas?: number | null;
  taxaPercentual?: number | null;
  prazoRecebimentoDias?: number | null;
  empresaId?: string | null;
  ativo?: boolean;
}

export type FormasPagamentoListResult = {
  formas: FormaPagamento[];
  total: number;
  page: number;
  limit: number;
};

function sanitize(dados: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '' && v !== undefined));
}

export const formasPagamentoService = {
  list: async (params: { search?: string; page?: number; limit?: number } = {}): Promise<FormasPagamentoListResult> => {
    const query: Record<string, unknown> = {};
    if (params.search) query.busca = params.search;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    const response = await api.get('/tenant/cadastros/formas-pagamento', { params: query });
    const d = response.data;
    return {
      formas: d.formas ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },

  create: async (dados: FormaPagamentoForm): Promise<{ id: string; message: string }> => {
    const response = await api.post('/tenant/cadastros/formas-pagamento', sanitize({ ...dados }));
    return response.data;
  },

  update: async (id: string, dados: Partial<FormaPagamentoForm>): Promise<{ message: string }> => {
    const response = await api.put(`/tenant/cadastros/formas-pagamento/${id}`, sanitize({ ...dados }));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/cadastros/formas-pagamento/${id}`);
  },
};
