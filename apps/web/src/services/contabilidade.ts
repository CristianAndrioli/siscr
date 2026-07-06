import api from './api'

const BASE = '/tenant/contabilidade'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanoConta {
  id: string
  codigo: string
  descricao: string
  tipo: 'ativo' | 'passivo' | 'pl' | 'receita' | 'despesa' | 'custo'
  natureza: 'devedora' | 'credora'
  nivel: number
  conta_pai_id: string | null
  conta_pai_descricao?: string | null
  aceita_lancamento: 0 | 1
  ativo: 0 | 1
}

export interface CentroCusto {
  id: string
  codigo: string
  descricao: string
  ativo: 0 | 1
}

export interface LancamentoPartida {
  id: string
  conta_id: string
  conta_codigo: string
  conta_descricao: string
  debito: number
  credito: number
  centro_custo_id: string | null
  historico_complementar: string | null
}

export interface Lancamento {
  id: string
  numero: number
  data_lancamento: string
  historico: string
  origem_tipo: string | null
  origem_id: string | null
  status: 'ativo' | 'estornado'
  created_at: string
  partidas: LancamentoPartida[]
}

export interface BalanceteLinha {
  id: string
  codigo: string
  descricao: string
  tipo: string
  natureza: string
  nivel: number
  total_debito: number
  total_credito: number
}

export interface DreLinha {
  codigo: string
  descricao: string
  tipo: string
  saldo_liquido: number
}

export interface DreResumo {
  receitaBruta: number
  totalCustos: number
  lucroBruto: number
  totalDespesas: number
  resultadoLiq: number
}

export interface MovimentoCaixa {
  numero: number
  data_lancamento: string
  historico: string
  origem_tipo: string | null
  conta_codigo: string
  conta_descricao: string
  debito: number
  credito: number
  saldo: number
}

// ─── Plano de Contas ─────────────────────────────────────────────────────────

export const planoContasService = {
  list: async (empresaId?: string): Promise<PlanoConta[]> => {
    const res = await api.get(`${BASE}/plano-contas`, { params: empresaId ? { empresaId } : {} })
    return res.data.contas ?? []
  },
  create: async (data: Omit<PlanoConta, 'id' | 'conta_pai_descricao'>): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/plano-contas`, {
      empresaId: data.conta_pai_id,
      codigo: data.codigo,
      descricao: data.descricao,
      tipo: data.tipo,
      natureza: data.natureza,
      nivel: data.nivel,
      contaPaiId: data.conta_pai_id,
      aceitaLancamento: data.aceita_lancamento === 1,
      ativo: data.ativo === 1,
    })
    return res.data
  },
  seed: async (empresaId?: string): Promise<{ ok: boolean; total: number }> => {
    const res = await api.post(`${BASE}/plano-contas/seed`, { empresaId })
    return res.data
  },
  update: async (id: string, data: Partial<PlanoConta>): Promise<void> => {
    await api.put(`${BASE}/plano-contas/${id}`, data)
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/plano-contas/${id}`)
  },
}

// ─── Centros de Custo ────────────────────────────────────────────────────────

export const centrosCustoService = {
  list: async (): Promise<CentroCusto[]> => {
    const res = await api.get(`${BASE}/centros-custo`)
    return res.data.centros ?? []
  },
  create: async (data: Omit<CentroCusto, 'id'>): Promise<{ id: string }> => {
    const res = await api.post(`${BASE}/centros-custo`, {
      codigo: data.codigo,
      descricao: data.descricao,
      ativo: data.ativo === 1,
    })
    return res.data
  },
}

// ─── Lançamentos ─────────────────────────────────────────────────────────────

export type LancamentoInput = {
  empresaId?: string | null
  dataLancamento: string
  historico: string
  partidas: Array<{
    contaId: string
    debito: number
    credito: number
    centroCustoId?: string | null
    historicoComplementar?: string | null
  }>
}

export const lancamentosService = {
  list: async (params?: { de?: string; ate?: string; contaId?: string; page?: number; limit?: number }) => {
    const res = await api.get(`${BASE}/lancamentos`, { params })
    return res.data as { lancamentos: Lancamento[]; total: number; page: number; limit: number }
  },
  get: async (id: string): Promise<Lancamento> => {
    const res = await api.get(`${BASE}/lancamentos/${id}`)
    return res.data
  },
  create: async (data: LancamentoInput): Promise<{ id: string; numero: number }> => {
    const res = await api.post(`${BASE}/lancamentos`, data)
    return res.data
  },
  estornar: async (id: string): Promise<{ estornoId: string; numero: number }> => {
    const res = await api.post(`${BASE}/lancamentos/${id}/estornar`)
    return res.data
  },
}

// ─── Relatórios ──────────────────────────────────────────────────────────────

export const relatoriosContabeis = {
  razao: async (contaId: string, de?: string, ate?: string) => {
    const res = await api.get(`${BASE}/relatorios/razao`, { params: { contaId, de, ate } })
    return res.data as { conta: PlanoConta; movimentos: any[] }
  },
  balancete: async (de?: string, ate?: string, empresaId?: string) => {
    const res = await api.get(`${BASE}/relatorios/balancete`, { params: { de, ate, empresaId } })
    return res.data as { contas: BalanceteLinha[]; total: { debito: number; credito: number } }
  },
  dre: async (de?: string, ate?: string, empresaId?: string) => {
    const res = await api.get(`${BASE}/relatorios/dre`, { params: { de, ate, empresaId } })
    return res.data as { linhas: DreLinha[]; resumo: DreResumo }
  },
  livroCaixa: async (de?: string, ate?: string, empresaId?: string) => {
    const res = await api.get(`${BASE}/relatorios/livro-caixa`, { params: { de, ate, empresaId } })
    return res.data as { movimentos: MovimentoCaixa[]; saldoFinal: number }
  },
}

// ─── Exportações ─────────────────────────────────────────────────────────────

export const exportacoesContabeis = {
  csv: (tipo: 'lancamentos' | 'balancete' | 'dre', de?: string, ate?: string): string => {
    const params = new URLSearchParams({ tipo, ...(de ? { de } : {}), ...(ate ? { ate } : {}) })
    return `${BASE}/exportar/csv?${params}`
  },
  ecd: (ano: number, empresaId: string): string => {
    return `${BASE}/exportar/ecd?ano=${ano}&empresaId=${empresaId}`
  },
  /** Baixa o ZIP de exportação para o contador (XMLs + CSVs) com autenticação. */
  contadorZip: async (de: string, ate: string, empresaId?: string): Promise<void> => {
    const res = await api.get(`${BASE}/exportar/contador`, {
      params: { de, ate, ...(empresaId ? { empresaId } : {}) },
      responseType: 'blob',
    })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `exportacao-contador_${de}_${ate}.zip`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
