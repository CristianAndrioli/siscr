import api from './api';

const BASE = '/tenant/frota';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Maquina {
  id: string;
  nome: string;
  modelo?: string;
  placa?: string;
  numero_serie?: string;
  ano_fabricacao?: number;
  capacidade?: string;
  status: 'operacional' | 'manutencao' | 'inativa';
  horimetro_atual: number;
  observacoes?: string;
  ativo: number;
  created_at: string;
}

export interface MaquinaForm {
  nome: string;
  modelo?: string;
  placa?: string;
  numeroSerie?: string;
  anoFabricacao?: number;
  capacidade?: string;
  status: 'operacional' | 'manutencao' | 'inativa';
  horimetroAtual: number;
  observacoes?: string;
  empresaId?: string;
}

export interface Obra {
  id: string;
  nome: string;
  cliente_id?: string;
  cliente_nome?: string;
  data_inicio?: string;
  data_fim?: string;
  localizacao?: string;
  municipio?: string;
  area_estimada?: string;
  status: 'em_andamento' | 'concluida' | 'cancelada';
  observacoes?: string;
  ativo: number;
  created_at: string;
}

export interface ObraForm {
  nome: string;
  clienteId?: string;
  dataInicio?: string;
  dataFim?: string;
  localizacao?: string;
  municipio?: string;
  areaEstimada?: string;
  status: 'em_andamento' | 'concluida' | 'cancelada';
  observacoes?: string;
  empresaId?: string;
}

export interface OrdemServico {
  id: string;
  obra_id: string;
  obra_nome?: string;
  maquina_id?: string;
  maquina_nome?: string;
  operador_id: string;
  operador_nome?: string;
  servico_id?: string;
  servico_nome?: string;
  status: 'pendente' | 'execucao' | 'concluido' | 'cancelado';
  descricao?: string;
  turno_data: string;
  turno_inicio?: string;
  turno_fim?: string;
  horimetro_inicial?: number;
  horimetro_final?: number;
  horas_trabalhadas?: number;
  valor_hora?: number;
  valor_total?: number;
  nota_fiscal_id?: string;
  detalhes_operacao?: string;
  created_at: string;
}

export interface OrdemServicoForm {
  obraId: string;
  operadorId: string;
  maquinaId?: string;
  servicoId?: string;
  status: 'pendente' | 'execucao' | 'concluido' | 'cancelado';
  descricao?: string;
  turnoData: string;
  turnoInicio?: string;
  turnoFim?: string;
  horimetroInicial?: number;
  horimetroFinal?: number;
  valorHora?: number;
  detalhesOperacao?: string;
  empresaId?: string;
}

export interface FrotaDashboard {
  maquinas: { total: number; operacionais: number; manutencao: number };
  ordens: { total: number; pendentes: number; em_execucao: number; concluidas: number; a_faturar: number };
  financeiro: { total_horas: number; total_valor: number; faturado: number };
}

// ─── Services ─────────────────────────────────────────────────────────────────

export const maquinasService = {
  list: async (params?: { busca?: string; status?: string; page?: number; limit?: number }) => {
    const res = await api.get(`${BASE}/maquinas`, { params });
    return { maquinas: (res.data.maquinas ?? []) as Maquina[], total: Number(res.data.total ?? 0), page: Number(res.data.page ?? 0), limit: Number(res.data.limit ?? 20) };
  },
  get: async (id: string): Promise<Maquina> => {
    const res = await api.get(`${BASE}/maquinas/${id}`);
    return res.data;
  },
  create: async (data: MaquinaForm): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/maquinas`, data);
    return res.data;
  },
  update: async (id: string, data: Partial<MaquinaForm>): Promise<void> => {
    await api.put(`${BASE}/maquinas/${id}`, data);
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/maquinas/${id}`);
  },
};

export const obrasService = {
  list: async (params?: { busca?: string; status?: string; clienteId?: string; page?: number; limit?: number }) => {
    const res = await api.get(`${BASE}/obras`, { params });
    return { obras: (res.data.obras ?? []) as Obra[], total: Number(res.data.total ?? 0), page: Number(res.data.page ?? 0), limit: Number(res.data.limit ?? 20) };
  },
  get: async (id: string): Promise<Obra> => {
    const res = await api.get(`${BASE}/obras/${id}`);
    return res.data;
  },
  create: async (data: ObraForm): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/obras`, data);
    return res.data;
  },
  update: async (id: string, data: Partial<ObraForm>): Promise<void> => {
    await api.put(`${BASE}/obras/${id}`, data);
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/obras/${id}`);
  },
};

export const ordensServicoService = {
  list: async (params?: { busca?: string; status?: string; obraId?: string; maquinaId?: string; page?: number; limit?: number }) => {
    const res = await api.get(`${BASE}/ordens`, { params });
    return { ordens: (res.data.ordens ?? []) as OrdemServico[], total: Number(res.data.total ?? 0), page: Number(res.data.page ?? 0), limit: Number(res.data.limit ?? 20) };
  },
  get: async (id: string): Promise<OrdemServico> => {
    const res = await api.get(`${BASE}/ordens/${id}`);
    return res.data;
  },
  create: async (data: OrdemServicoForm): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/ordens`, data);
    return res.data;
  },
  update: async (id: string, data: Partial<OrdemServicoForm>): Promise<void> => {
    await api.put(`${BASE}/ordens/${id}`, data);
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/ordens/${id}`);
  },
  faturar: async (id: string): Promise<{ nota_fiscal_id: string; message: string; redirect: string }> => {
    const res = await api.post(`${BASE}/ordens/${id}/faturar`);
    return res.data;
  },
};

export const frotaDashboardService = {
  get: async (): Promise<FrotaDashboard> => {
    const res = await api.get(`${BASE}/dashboard`);
    return res.data;
  },
};
