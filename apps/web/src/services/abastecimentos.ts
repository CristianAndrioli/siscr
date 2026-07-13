import api from './api';

const BASE = '/tenant/frota';

export interface Abastecimento {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  maquina_id: string;
  maquina_nome?: string;
  obra_id: string | null;
  data: string;
  litros: number;
  valor_total: number;
  horimetro: number | null;
  posto: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AbastecimentoForm {
  maquinaId: string;
  obraId?: string | null;
  data: string;
  litros: number;
  valorTotal: number;
  horimetro?: number | null;
  posto?: string | null;
  observacoes?: string | null;
  empresaId?: string;
}

export type AbastecimentosListResult = {
  abastecimentos: Abastecimento[];
  total: number;
  page: number;
  limit: number;
};

function sanitize(dados: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '' && v !== undefined));
}

export const abastecimentosService = {
  list: async (params: { maquinaId?: string; page?: number; limit?: number } = {}): Promise<AbastecimentosListResult> => {
    const query: Record<string, unknown> = {};
    if (params.maquinaId) query.maquinaId = params.maquinaId;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    const response = await api.get(`${BASE}/abastecimentos`, { params: query });
    const d = response.data;
    return {
      abastecimentos: d.abastecimentos ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },

  create: async (dados: AbastecimentoForm): Promise<{ id: string; message: string }> => {
    const response = await api.post(`${BASE}/abastecimentos`, sanitize({ ...dados }));
    return response.data;
  },

  update: async (id: string, dados: Partial<AbastecimentoForm>): Promise<{ message: string }> => {
    const response = await api.put(`${BASE}/abastecimentos/${id}`, sanitize({ ...dados }));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/abastecimentos/${id}`);
  },
};
