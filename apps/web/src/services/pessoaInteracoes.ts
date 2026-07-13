import api from './api';

export type InteracaoTipo = 'ligacao' | 'email' | 'reuniao' | 'visita' | 'outro';

export interface Interacao {
  id: string;
  pessoa_id: string;
  pessoa_nome: string;
  tipo: InteracaoTipo;
  data: string;
  descricao: string;
  created_at: string;
}

export interface InteracaoForm {
  pessoaId: string;
  tipo: InteracaoTipo;
  data: string;
  descricao: string;
}

export const TIPO_INTERACAO_LABEL: Record<InteracaoTipo, string> = {
  ligacao: 'Ligação', email: 'E-mail', reuniao: 'Reunião', visita: 'Visita', outro: 'Outro',
};

export const pessoaInteracoesService = {
  list: async (params: { pessoaId?: string; tipo?: InteracaoTipo } = {}): Promise<Interacao[]> => {
    const r = await api.get('/tenant/vendas/interacoes', { params: { ...params, limit: 200 } });
    return r.data.interacoes ?? [];
  },
  create: async (form: InteracaoForm): Promise<{ id: string }> => {
    const r = await api.post('/tenant/vendas/interacoes', form);
    return r.data;
  },
  update: async (id: string, form: Partial<InteracaoForm>): Promise<void> => {
    await api.put(`/tenant/vendas/interacoes/${id}`, form);
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/tenant/vendas/interacoes/${id}`);
  },
};
