import api from './api';

export type CotacaoStatus = 'rascunho' | 'enviada' | 'aprovada' | 'recusada' | 'expirada';
export type CotacaoTipo = 'venda' | 'compra';
export type NFStatus = 'rascunho' | 'pendente_emissao' | 'autorizada' | 'emitida' | 'cancelada' | 'inutilizada';
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
  tipo?: CotacaoTipo;
  /** Obrigatório — isolamento por empresa dentro do tenant. */
  empresa_id?: string;
  /** `null` = matriz. */
  filial_id?: string | null;
  empresa_nome?: string | null;
  filial_nome?: string | null;
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

/** Resposta de GET …/notas/:id/verificacao-assinatura */
export type VerificacaoAssinaturaNfe = {
  possuiAssinatura: boolean
  valida: boolean
  mensagem: string
  signatureMethod?: string
  digestMethod?: string
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
  xml_path?: string | null;
  empresa_id?: string;
  data_emissao?: string;
  motivo_cancelamento?: string;
  protocolo_autorizacao?: string | null;
  data_autorizacao?: string | null;
  cstat_ultimo?: string | null;
  xmotivo_ultimo?: string | null;
  transmissao_erro?: string | null;
  ambiente?: number | null;
  created_at: string;
  updated_at?: string;
  itens?: NFItem[];
}

const BASE = '/tenant/faturamento';

function mapCotacaoItemPayload(i: CotacaoItem) {
  return {
    ...(i.produtoId ? { produtoId: i.produtoId } : {}),
    ...(i.servicoId ? { servicoId: i.servicoId } : {}),
    descricao: i.descricao,
    quantidade: i.quantidade,
    valorUnitario: i.valorUnitario,
    desconto: i.desconto ?? 0,
    unidade: i.unidade ?? 'UN',
  };
}

export type CotacaoResumoStatus = {
  status: string;
  quantidade: number;
  valor_total: number;
};

export type CotacaoListResponse = {
  cotacoes: Cotacao[];
  total: number;
  page: number;
  limit: number;
  resumo: CotacaoResumoStatus[];
};

export const cotacoesService = {
  list: async (params?: {
    status?: string;
    busca?: string;
    tipo?: CotacaoTipo;
    empresaId?: string;
    filialId?: string | null;
    page?: number;
    limit?: number;
  }): Promise<CotacaoListResponse> => {
    const res = await api.get(`${BASE}/cotacoes`, {
      params: {
        ...params,
        filialId: params?.filialId === null ? '' : params?.filialId,
      },
    });
    return {
      cotacoes: res.data.cotacoes ?? [],
      total: Number(res.data.total ?? 0),
      page: Number(res.data.page ?? 0),
      limit: Number(res.data.limit ?? 50),
      resumo: res.data.resumo ?? [],
    };
  },
  get: async (id: string): Promise<Cotacao> => {
    const res = await api.get(`${BASE}/cotacoes/${id}`);
    return res.data.cotacao;
  },
  create: async (data: Omit<Cotacao, 'id' | 'numero' | 'created_at'> & { itens: CotacaoItem[] }): Promise<{ id: string; numero: string }> => {
    const res = await api.post(`${BASE}/cotacoes`, {
      tipo: data.tipo ?? 'venda',
      empresaId: data.empresa_id,
      filialId: data.filial_id || null,
      pessoaId: data.pessoa_id || undefined, // never send empty string
      validade: data.validade,
      observacoes: data.observacoes,
      desconto: data.desconto ?? 0,
      status: data.status,
      itens: (data.itens ?? []).map(mapCotacaoItemPayload),
    });
    return res.data;
  },
  update: async (id: string, data: Partial<Cotacao> & { itens?: CotacaoItem[] }): Promise<void> => {
    await api.put(`${BASE}/cotacoes/${id}`, {
      empresaId: data.empresa_id || undefined,
      filialId: data.filial_id === undefined ? undefined : data.filial_id || null,
      pessoaId: data.pessoa_id || undefined,
      validade: data.validade,
      observacoes: data.observacoes,
      desconto: data.desconto,
      status: data.status,
      itens: data.itens?.map(mapCotacaoItemPayload),
    });
  },
  /** Altera o status de várias cotações sem abrir cada uma. */
  updateStatusBatch: async (ids: string[], status: CotacaoStatus): Promise<{ atualizadas: number }> => {
    const res = await api.patch(`${BASE}/cotacoes/status`, { ids, status });
    return { atualizadas: Number(res.data.atualizadas ?? 0) };
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
  /** Eventos de transmissão / rejeição gravados para a aba Logs da nota. */
  listEventos: async (
    id: string,
    params?: { page?: number; limit?: number },
  ): Promise<{
    events: Array<{
      id: string
      timestamp: string
      friendly_message: string
      technical?: string | null
      url?: string | null
      context?: string | null
      created_at: string
    }>
    total: number
    page: number
    limit: number
  }> => {
    const res = await api.get(`${BASE}/notas/${id}/eventos`, {
      params: { page: params?.page ?? 0, limit: params?.limit ?? 100 },
    });
    return {
      events: res.data.events ?? [],
      total: Number(res.data.total ?? 0),
      page: Number(res.data.page ?? 0),
      limit: Number(res.data.limit ?? 100),
    };
  },
  listFinanceiro: async (
    id: string,
  ): Promise<{
    contasReceber: Array<{
      id: string
      codigo?: number | null
      descricao: string
      valor: number
      vencimento: string
      status: string
      parcela?: number | null
      total_parcelas?: number | null
      valor_pago?: number | null
      data_pagamento?: string | null
      categoria?: string | null
      cliente?: string | null
      created_at?: string
    }>
    lancamentos: Array<{
      id: string
      numero?: number | null
      data_lancamento: string
      historico: string
      origem_tipo?: string | null
      status: string
      created_at?: string
    }>
  }> => {
    const res = await api.get(`${BASE}/notas/${id}/financeiro`);
    return {
      contasReceber: res.data.contasReceber ?? [],
      lancamentos: res.data.lancamentos ?? [],
    };
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
  /** Gera chave + XML no R2; assina com A1 se configurado. Query force=1 regera. */
  prepararXml: async (
    id: string,
    opts?: { force?: boolean },
  ): Promise<{
    chaveAcesso: string
    xmlPath: string
    devMode: boolean
    signed: boolean
    message: string
  }> => {
    const res = await api.post(
      `${BASE}/notas/${id}/preparar-xml`,
      {},
      { params: opts?.force ? { force: '1' } : undefined },
    );
    return res.data;
  },
  /** Confronta XML no R2 com leiaute 4.00 (sem SEFAZ). */
  validarXml: async (
    id: string,
  ): Promise<{
    ok: boolean
    layoutVersion: string
    chaveAcesso: string | null
    signed: boolean
    errors: { path: string; message: string }[]
    message: string
  }> => {
    const res = await api.post(`${BASE}/notas/${id}/validar-xml`, {});
    return res.data;
  },
  /** Baixa o XML armazenado no R2 (assinado ou não). */
  downloadXml: async (id: string): Promise<Blob> => {
    const res = await api.get(`${BASE}/notas/${id}/xml`, { responseType: 'blob' });
    return res.data as Blob;
  },
  /** Valida XML-DSig (digest + RSA) do arquivo no R2. */
  verificacaoAssinatura: async (id: string): Promise<VerificacaoAssinaturaNfe> => {
    const res = await api.get(`${BASE}/notas/${id}/verificacao-assinatura`);
    return res.data as VerificacaoAssinaturaNfe;
  },
  /** HTML imprimível — prévia estilo DANFE para testes. */
  danfePreviewBlob: async (id: string): Promise<Blob> => {
    const res = await api.get(`${BASE}/notas/${id}/danfe-preview`, { responseType: 'blob' });
    return res.data as Blob;
  },
  /** Envia XML assinado à SEFAZ (NFeAutorizacao4) via ponte sefaz-dfe. */
  transmitir: async (
    id: string,
  ): Promise<{
    message: string
    autorizada: boolean
    cStat: string
    xMotivo: string
    protocolo?: string | null
    dataAutorizacao?: string | null
    status?: string
    procNfePath?: string | null
  }> => {
    const res = await api.post(`${BASE}/notas/${id}/transmitir`, {});
    return res.data;
  },
  /** Gera DPS/RPS assinado e grava no R2. */
  prepararNfse: async (
    id: string,
    opts?: { force?: boolean },
  ): Promise<{
    xmlPath: string
    signed: boolean
    adapter: string
    numero: number
    serie: string
    message: string
  }> => {
    const res = await api.post(
      `${BASE}/notas/${id}/preparar-nfse`,
      {},
      { params: opts?.force ? { force: '1' } : undefined },
    );
    return res.data;
  },
  /** Transmite NFS-e à prefeitura / Sefin Nacional. */
  transmitirNfse: async (
    id: string,
  ): Promise<{
    message: string
    autorizada: boolean
    cStat: string
    xMotivo: string
    protocolo?: string | null
    chaveAcesso?: string | null
    dataAutorizacao?: string | null
    status?: string
    adapter?: string
  }> => {
    const res = await api.post(`${BASE}/notas/${id}/transmitir-nfse`, {});
    return res.data;
  },
};

export type NcmSyncRunRow = {
  id: string;
  source: string;
  status: string;
  message: string | null;
  row_count: number | null;
  content_sha256: string | null;
  payload_meta: string | null;
  started_at: string;
  finished_at: string | null;
};

export type NcmStatusResponse = {
  activeBatchId: string | null;
  itemCount: number;
  recentSyncs: NcmSyncRunRow[];
};

export type NcmItemRow = {
  codigo: string;
  descricao: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  /** dd-MM-yyyy (calculado no SQL para exibição). */
  vigenciaInicioBr: string;
  vigenciaFimBr: string;
};

export type NcmItemsResponse = {
  items: NcmItemRow[];
  total: number;
  page: number;
  limit: number;
};

export type NcmSyncPostResponse = {
  ok: boolean;
  skipped?: boolean;
  batchId?: string;
  rowCount?: number;
  sha256?: string;
  source: string;
  message: string;
  meta?: Record<string, string | undefined>;
};

export const ncmCatalogService = {
  status: async (): Promise<NcmStatusResponse> => {
    const res = await api.get(`${BASE}/ncm/status`);
    return res.data as NcmStatusResponse;
  },
  items: async (params?: {
    q?: string;
    limit?: number;
    page?: number;
    /** Catálogo completo para export (até 120k linhas; ignora page). */
    full?: boolean;
  }): Promise<NcmItemsResponse> => {
    const res = await api.get(`${BASE}/ncm/items`, {
      params: {
        q: params?.q,
        limit: params?.limit,
        page: params?.page,
        full: params?.full ? '1' : undefined,
      },
    });
    return res.data as NcmItemsResponse;
  },
  syncClassif: async (force?: boolean): Promise<NcmSyncPostResponse> => {
    const res = await api.post(`${BASE}/ncm/sync/classif`, {}, { params: force ? { force: '1' } : undefined });
    return res.data as NcmSyncPostResponse;
  },
  syncBrasilApi: async (force?: boolean): Promise<NcmSyncPostResponse> => {
    const res = await api.post(`${BASE}/ncm/sync/brasilapi`, {}, { params: force ? { force: '1' } : undefined });
    return res.data as NcmSyncPostResponse;
  },
};
