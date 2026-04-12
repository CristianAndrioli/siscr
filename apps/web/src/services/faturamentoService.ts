import api from './api';

export type CotacaoStatus = 'rascunho' | 'enviada' | 'aprovada' | 'recusada' | 'expirada';
export type NFStatus = 'rascunho' | 'pendente_emissao' | 'emitida' | 'cancelada' | 'inutilizada';
export type NFTipo = 'nfe' | 'nfse';

export interface CotacaoItem {
  id?: string;
  produtoId?: string;
  servicoId?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  valor_total?: number;
  unidade: string;
}

export interface Cotacao {
  id: string;
  numero: string;
  pessoa_id?: string;
  cliente?: string;
  validade?: string;
  observacoes?: string;
  desconto: number;
  valor_total: number;
  status: CotacaoStatus;
  created_at: string;
  updated_at?: string;
  itens?: CotacaoItem[];
  cpf_cnpj?: string;
  email?: string;
}

export interface NFItem {
  id?: string;
  produtoId?: string;
  servicoId?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  valor_total?: number;
  unidade: string;
  cfop?: string;
  ncm?: string;
  origem?: number;
  icmsCst?: string;
  icmsCsosn?: string;
  icmsModalidadeBc?: number;
  icmsBaseCalculo?: number;
  icmsAliquota?: number;
  icmsValor?: number;
  icmsCreditoAliquota?: number;
  icmsCreditoValor?: number;
  pisCst?: string;
  pisBaseCalculo?: number;
  pisAliquota?: number;
  pisValor?: number;
  cofinsCst?: string;
  cofinsBaseCalculo?: number;
  cofinsAliquota?: number;
  cofinsValor?: number;
  ipiCst?: string;
  ipiBaseCalculo?: number;
  ipiAliquota?: number;
  ipiValor?: number;
}

export interface NotaFiscal {
  id: string;
  tipo: NFTipo;
  numero?: number;
  serie?: string;
  destinatario_id?: string;
  destinatario?: string;
  cpf_cnpj?: string;
  natureza_operacao?: string;
  descricao_servico?: string;
  aliquota_iss?: number;
  valor_iss?: number;
  codigo_servico?: string;
  observacoes?: string;
  valor_produtos: number;
  valor_desconto: number;
  valor_total: number;
  status: NFStatus;
  chave_acesso?: string;
  empresa_id?: string;
  data_emissao?: string;
  motivo_cancelamento?: string;
  created_at: string;
  updated_at?: string;
  itens?: NFItem[];
}

const BASE = '/tenant/faturamento';

export const cotacoesService = {
  list: async (params?: { status?: string; busca?: string }): Promise<Cotacao[]> => {
    const res = await api.get(`${BASE}/cotacoes`, { params });
    return res.data.cotacoes ?? [];
  },
  get: async (id: string): Promise<Cotacao> => {
    const res = await api.get(`${BASE}/cotacoes/${id}`);
    return res.data.cotacao;
  },
  create: async (data: Omit<Cotacao, 'id' | 'numero' | 'created_at'> & { itens: CotacaoItem[] }): Promise<{ id: string; numero: string }> => {
    const res = await api.post(`${BASE}/cotacoes`, {
      pessoaId: data.pessoa_id || undefined, // never send empty string
      validade: data.validade,
      observacoes: data.observacoes,
      desconto: data.desconto ?? 0,
      status: data.status,
      itens: (data.itens ?? []).map(i => ({
        produtoId: i.produtoId,
        servicoId: i.servicoId,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
        desconto: i.desconto ?? 0,
        unidade: i.unidade ?? 'UN',
      })),
    });
    return res.data;
  },
  update: async (id: string, data: Partial<Cotacao> & { itens?: CotacaoItem[] }): Promise<void> => {
    await api.put(`${BASE}/cotacoes/${id}`, {
      pessoaId: data.pessoa_id || undefined,
      validade: data.validade,
      observacoes: data.observacoes,
      desconto: data.desconto,
      status: data.status,
      itens: data.itens?.map(i => ({
        produtoId: i.produtoId,
        servicoId: i.servicoId,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
        desconto: i.desconto ?? 0,
        unidade: i.unidade ?? 'UN',
      })),
    });
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/cotacoes/${id}`);
  },
};

export const notasService = {
  list: async (params?: { tipo?: string; status?: string; busca?: string }): Promise<NotaFiscal[]> => {
    const res = await api.get(`${BASE}/notas`, { params });
    return res.data.notas ?? [];
  },
  get: async (id: string): Promise<NotaFiscal> => {
    const res = await api.get(`${BASE}/notas/${id}`);
    return res.data.nota;
  },
  create: async (data: {
    tipo: NFTipo;
    empresaId?: string;
    filialId?: string;
    pedidoId?: string;
    destinatarioId?: string;
    naturezaOperacao?: string;
    descricaoServico?: string;
    aliquotaIss?: number;
    codigoServico?: string;
    observacoes?: string;
    desconto?: number;
    formaPagamento?: string;
    modFrete?: number;
    ambiente?: number;
    modelo?: number;
    serie?: string;
    valorTroco?: number;
    itens: NFItem[];
  }): Promise<{ id: string; numero: number }> => {
    const res = await api.post(`${BASE}/notas`, {
      ...data,
      itens: data.itens.map((i) => ({
        produtoId: i.produtoId,
        servicoId: i.servicoId,
        descricao: i.descricao,
        quantidade: i.quantidade,
        valorUnitario: i.valorUnitario,
        desconto: i.desconto ?? 0,
        unidade: i.unidade ?? 'UN',
        cfop: i.cfop,
        ncm: i.ncm,
        origem: i.origem,
        icmsCst: i.icmsCst,
        icmsCsosn: i.icmsCsosn,
        icmsModalidadeBc: i.icmsModalidadeBc,
        icmsBaseCalculo: i.icmsBaseCalculo,
        icmsAliquota: i.icmsAliquota,
        icmsValor: i.icmsValor,
        icmsCreditoAliquota: i.icmsCreditoAliquota,
        icmsCreditoValor: i.icmsCreditoValor,
        pisCst: i.pisCst,
        pisBaseCalculo: i.pisBaseCalculo,
        pisAliquota: i.pisAliquota,
        pisValor: i.pisValor,
        cofinsCst: i.cofinsCst,
        cofinsBaseCalculo: i.cofinsBaseCalculo,
        cofinsAliquota: i.cofinsAliquota,
        cofinsValor: i.cofinsValor,
        ipiCst: i.ipiCst,
        ipiBaseCalculo: i.ipiBaseCalculo,
        ipiAliquota: i.ipiAliquota,
        ipiValor: i.ipiValor,
      })),
    });
    return res.data;
  },
  update: async (id: string, data: Partial<NotaFiscal> & { itens?: NFItem[] }): Promise<void> => {
    await api.put(`${BASE}/notas/${id}`, data);
  },
  cancelar: async (id: string, motivo?: string): Promise<void> => {
    await api.post(`${BASE}/notas/${id}/cancelar`, { motivo });
  },
  faturar: async (
    id: string,
    condicao?: { parcelas: number; vencimento: string; intervalo_dias: number },
  ): Promise<{ message: string; itens_baixados: number; conta_receber_criada: boolean; parcelas_criadas: number }> => {
    const res = await api.post(`${BASE}/notas/${id}/faturar`, condicao ?? {});
    return res.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/notas/${id}`);
  },
  /** Gera chave + XML no R2 (sem envio SOAP nesta versão). Query force=1 regera. */
  prepararXml: async (
    id: string,
    opts?: { force?: boolean },
  ): Promise<{ chaveAcesso: string; xmlPath: string; devMode: boolean; message: string }> => {
    const res = await api.post(
      `${BASE}/notas/${id}/preparar-xml`,
      {},
      { params: opts?.force ? { force: '1' } : undefined },
    );
    return res.data;
  },
};
