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
  data_conclusao?: string;
  localizacao?: string;
  municipio?: string;
  area_estimada?: string;
  status: 'em_andamento' | 'concluida' | 'cancelada';
  valor_faturado?: number;
  observacoes?: string;
  ativo: number;
  created_at: string;
}

export interface ObraMaquina {
  id: string;
  obra_id: string;
  maquina_id: string;
  maquina_nome?: string;
  maquina_placa?: string;
  maquina_status?: string;
  horimetro_atual?: number;
  valor_hora?: number;
  data_alocacao?: string;
  data_liberacao?: string;
  observacoes?: string;
}

export interface ObraResumo {
  total_os: number;
  total_horas: number;
  total_valor: number;
  a_faturar: number;
  faturado: number;
  horas_a_faturar: number;
  maquinas_alocadas: number;
  total_medicoes: number;
}

export interface Medicao {
  id: string;
  obra_id: string;
  numero: number;
  descricao?: string;
  periodo_inicio?: string;
  periodo_fim?: string;
  total_horas?: number;
  valor_total?: number;
  status: 'rascunho' | 'faturada' | 'cancelada';
  nota_fiscal_id?: string;
  created_at: string;
}

export interface ApontamentoLinha {
  maquinaId?: string;
  operadorId: string;
  servicoId?: string;
  descricao?: string;
  horimetroInicial?: number;
  horimetroFinal?: number;
  horas?: number;
  valorHora?: number;
}

export interface ApontamentoPayload {
  turnoData: string;
  turnoInicio?: string;
  turnoFim?: string;
  linhas: ApontamentoLinha[];
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
  finalizar: async (id: string): Promise<{ message: string; aviso: string | null; apontamentos_pendentes: number }> => {
    const res = await api.post(`${BASE}/obras/${id}/finalizar`);
    return res.data;
  },
  resumo: async (id: string): Promise<ObraResumo> => {
    const res = await api.get(`${BASE}/obras/${id}/resumo`);
    return res.data;
  },
  maquinas: async (id: string): Promise<ObraMaquina[]> => {
    const res = await api.get(`${BASE}/obras/${id}/maquinas`);
    return (res.data.maquinas ?? []) as ObraMaquina[];
  },
  alocarMaquina: async (id: string, body: { maquinaId: string; valorHora?: number; dataAlocacao?: string; observacoes?: string }): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/obras/${id}/maquinas`, body);
    return res.data;
  },
  removerMaquina: async (obraId: string, maquinaId: string): Promise<void> => {
    await api.delete(`${BASE}/obras/${obraId}/maquinas/${maquinaId}`);
  },
  apontarHoras: async (id: string, body: ApontamentoPayload): Promise<{ message: string; count: number }> => {
    const res = await api.post(`${BASE}/obras/${id}/apontamentos`, body);
    return res.data;
  },
  medicoes: async (id: string): Promise<Medicao[]> => {
    const res = await api.get(`${BASE}/obras/${id}/medicoes`);
    return (res.data.medicoes ?? []) as Medicao[];
  },
  gerarMedicao: async (id: string, params?: { periodoInicio?: string; periodoFim?: string; descricao?: string }): Promise<{ medicao_id: string; numero: number; nota_fiscal_id: string; total: number; ordens: number; message: string; redirect: string }> => {
    const res = await api.post(`${BASE}/obras/${id}/medicoes`, params ?? {});
    return res.data;
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
