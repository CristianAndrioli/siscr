import api from './api';

export type Estagio = 'novo' | 'qualificado' | 'proposta' | 'negociacao' | 'ganho' | 'perdido';

export interface Oportunidade {
  id: string;
  titulo: string;
  pessoa_id: string | null;
  pessoa_nome: string | null;
  vendedor_id: string | null;
  vendedor_nome: string | null;
  valor_estimado: number;
  estagio: Estagio;
  probabilidade: number;
  data_prevista_fechamento: string | null;
  motivo_perda: string | null;
  created_at: string;
}

export interface OportunidadeForm {
  titulo: string;
  pessoaId?: string;
  vendedorId?: string;
  valorEstimado: number;
  probabilidade: number;
  dataPrevistaFechamento?: string;
}

export const ESTAGIO_LABEL: Record<Estagio, string> = {
  novo: 'Novo',
  qualificado: 'Qualificado',
  proposta: 'Proposta',
  negociacao: 'Negociação',
  ganho: 'Ganho',
  perdido: 'Perdido',
};

export const ESTAGIOS_KANBAN: Estagio[] = ['novo', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido'];

export const oportunidadesService = {
  list: async (vendedorId?: string): Promise<Oportunidade[]> => {
    const r = await api.get('/tenant/vendas/oportunidades', { params: vendedorId ? { vendedorId } : {} });
    return r.data.oportunidades ?? [];
  },
  create: async (form: OportunidadeForm): Promise<{ id: string }> => {
    const r = await api.post('/tenant/vendas/oportunidades', form);
    return r.data;
  },
  update: async (id: string, form: Partial<OportunidadeForm>): Promise<void> => {
    await api.put(`/tenant/vendas/oportunidades/${id}`, form);
  },
  mudarEstagio: async (id: string, estagio: Estagio, motivoPerda?: string): Promise<void> => {
    await api.patch(`/tenant/vendas/oportunidades/${id}/estagio`, { estagio, motivoPerda });
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/vendas/oportunidades/${id}`);
  },
};
