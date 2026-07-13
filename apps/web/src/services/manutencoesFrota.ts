import api from './api';

const BASE = '/tenant/frota';

export type ManutencaoTipo = 'preventiva' | 'corretiva';
export type ManutencaoStatus = 'pendente' | 'concluida' | 'cancelada';

export const TIPO_LABEL: Record<ManutencaoTipo, string> = {
  preventiva: 'Preventiva',
  corretiva: 'Corretiva',
};

export const STATUS_LABEL: Record<ManutencaoStatus, string> = {
  pendente: 'Pendente',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export interface ManutencaoFrota {
  id: string;
  tenant_id: string;
  empresa_id: string | null;
  maquina_id: string;
  maquina_nome?: string;
  tipo: ManutencaoTipo;
  descricao: string;
  data_prevista: string | null;
  data_realizada: string | null;
  horimetro_previsto: number | null;
  status: ManutencaoStatus;
  custo: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ManutencaoFrotaForm {
  maquinaId: string;
  tipo: ManutencaoTipo;
  descricao: string;
  dataPrevista?: string | null;
  dataRealizada?: string | null;
  horimetroPrevisto?: number | null;
  status: ManutencaoStatus;
  custo?: number | null;
  observacoes?: string | null;
  empresaId?: string;
}

export type ManutencoesFrotaListResult = {
  manutencoes: ManutencaoFrota[];
  total: number;
  page: number;
  limit: number;
};

function sanitize(dados: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v !== '' && v !== undefined));
}

export const manutencoesFrotaService = {
  list: async (params: { maquinaId?: string; status?: string; page?: number; limit?: number } = {}): Promise<ManutencoesFrotaListResult> => {
    const query: Record<string, unknown> = {};
    if (params.maquinaId) query.maquinaId = params.maquinaId;
    if (params.status) query.status = params.status;
    if (params.page !== undefined) query.page = params.page;
    if (params.limit !== undefined) query.limit = params.limit;
    const response = await api.get(`${BASE}/manutencoes`, { params: query });
    const d = response.data;
    return {
      manutencoes: d.manutencoes ?? [],
      total: Number(d.total ?? 0),
      page: Number(d.page ?? 0),
      limit: Number(d.limit ?? 10),
    };
  },

  create: async (dados: ManutencaoFrotaForm): Promise<{ id: string; message: string }> => {
    const response = await api.post(`${BASE}/manutencoes`, sanitize({ ...dados }));
    return response.data;
  },

  update: async (id: string, dados: Partial<ManutencaoFrotaForm>): Promise<{ message: string }> => {
    const response = await api.put(`${BASE}/manutencoes/${id}`, sanitize({ ...dados }));
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/manutencoes/${id}`);
  },
};
