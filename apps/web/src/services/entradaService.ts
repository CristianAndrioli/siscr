import api from './api';

export interface NfEntradaListItem {
  id: string;
  chave_acesso: string;
  emitente_cnpj: string;
  emitente_nome: string | null;
  data_emissao: string | null;
  numero: number | null;
  serie: string | null;
  valor_total: number;
  status: string;
  origem?: 'xml' | 'manual' | string;
  empresa_id?: string | null;
  filial_id?: string | null;
  pedido_compra_id?: string | null;
  fornecedor_id: string | null;
  created_at: string;
  fornecedor_nome?: string | null;
}

export interface NfEntradaManualItemInput {
  produtoId: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  desconto?: number;
  unidade?: string;
  ncm?: string;
  cfop?: string;
  itemPedidoId?: string | null;
}

export interface NfEntradaManualCreate {
  empresaId: string;
  filialId?: string | null;
  fornecedorId: string;
  numero: number;
  serie?: string;
  dataEmissao: string;
  naturezaOperacao?: string;
  desconto?: number;
  itens: NfEntradaManualItemInput[];
  cobranca?: { numero?: string; vencimento: string; valor: number }[];
  pedidoCompraId?: string;
  gerarEstoque?: boolean;
  gerarContasPagar?: boolean;
}

export interface NfEntradaItem {
  nItem?: number;
  cProd?: string;
  descricao: string;
  quantidade: number;
  valorUnitario?: number;
  valorTotal: number;
  cfop?: string;
  ncm?: string;
  unidade?: string;
  produto_id?: string;
  criado_no_import?: boolean;
  /** Número do pedido de compra informado pelo fornecedor no XML. */
  xPed?: string;
  /** Item do pedido de compra correspondente, informado no XML. */
  nItemPed?: number;
  /** Item do pedido de compra que este item baixou. */
  item_pedido_id?: string;
}

export interface ItemPedidoCompraSaldo {
  id: string;
  seq: number;
  produto_id: string;
  produto_codigo: string | null;
  produto_descricao: string | null;
  quantidade: number;
  quantidade_recebida: number;
  saldo: number;
  preco_unitario: number;
}

export interface PedidoCompraResumo {
  id: string;
  numero: number;
  status: string;
  total: number;
  fornecedor_id: string;
  created_at: string;
}

export type PedidoCompraComItens = PedidoCompraResumo & { itens: ItemPedidoCompraSaldo[] };

/** Como cada item da nota foi casado com o pedido. */
export interface VinculoItemPedido {
  indice: number;
  itemPedidoId: string | null;
  origem: 'nItemPed' | 'produto' | 'manual' | 'none';
}

export interface DivergenciaVinculo {
  indice: number;
  tipo: 'quantidade_acima_saldo' | 'quantidade_parcial' | 'preco' | 'sem_correspondencia';
  /** Quando true, a importação não passa enquanto o item estiver vinculado assim. */
  bloqueia: boolean;
  mensagem: string;
}

export interface NfEntradaPreview {
  parsed: unknown;
  sugestoes: { indice: number; produtoId: string | null; motivo: string; rotulo?: string }[];
  assinatura_valida: boolean;
  fornecedor_id: string | null;
  fornecedor_sera_cadastrado?: boolean;
  nfce_sem_dest?: boolean;
  import_kind?: 'nfe' | 'nfce';
  modelo_fiscal?: number;
  fiscal_xml_family?: string;
  numero_pedido_xml: number | null;
  pedido_sugerido: PedidoCompraComItens | null;
  pedido_origem: 'xped' | 'unico_aberto' | null;
  pedidos_abertos: PedidoCompraResumo[];
  vinculos_pedido: VinculoItemPedido[];
  divergencias: DivergenciaVinculo[];
}

export async function previewNfEntradaXml(file: File, empresaId: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('empresaId', empresaId);
  const { data } = await api.post<NfEntradaPreview>('/tenant/entrada/nf-entradas/preview-xml', form);
  return data;
}

/** Recalcula casamento e divergências quando o usuário troca o pedido no assistente. */
export async function avaliarVinculoPedido(payload: {
  pedidoCompraId: string;
  itens: {
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    nItemPed?: number;
    produtoId?: string | null;
  }[];
  overrides?: { indice: number; itemPedidoId: string | null }[];
}) {
  const { data } = await api.post<{
    pedido: PedidoCompraComItens;
    vinculos_pedido: VinculoItemPedido[];
    divergencias: DivergenciaVinculo[];
  }>('/tenant/entrada/nf-entradas/avaliar-vinculo', payload);
  return data;
}

export async function confirmarNfEntradaImport(payload: {
  xmlBase64: string;
  empresaId: string;
  filialId?: string | null;
  vinculos: { indice: number; produtoId?: string; criar?: boolean; itemPedidoId?: string | null }[];
  /** Quando informado, a nota gera o recebimento deste pedido de compra. */
  pedidoCompraId?: string | null;
  /** Obrigatório quando o preview indica NFC-e sem grupo dest no XML. */
  confirmarDestinoEmpresa?: boolean;
}) {
  const { data } = await api.post<{
    id: string;
    message: string;
    fornecedor_vinculado: boolean;
    assinatura_valida: boolean;
    pedido_compra_id: string | null;
    pedido_compra_numero: number | null;
    pedido_compra_status: string | null;
    itens_baixados_no_pedido: number;
  }>('/tenant/entrada/nf-entradas/confirmar', payload);
  return data;
}

export async function listNfEntradas(params?: { empresaId?: string; filialId?: string; page?: number; limit?: number }) {
  const { data } = await api.get<{ entradas: NfEntradaListItem[]; total: number; page: number; limit: number }>(
    '/tenant/entrada/nf-entradas',
    { params }
  );
  return data;
}

export async function criarNfEntradaManual(payload: NfEntradaManualCreate) {
  const { data } = await api.post<{
    id: string;
    message: string;
    origem: 'manual';
    status: string;
    pedido_compra_id: string | null;
    pedido_compra_status: string | null;
    recebimento_id: string | null;
    contas_pagar_criadas: string[];
  }>('/tenant/entrada/nf-entradas', payload);
  return data;
}

export async function getNfEntrada(id: string) {
  const { data } = await api.get<Record<string, unknown> & { itens: NfEntradaItem[]; contas_pagar: unknown[] }>(
    `/tenant/entrada/nf-entradas/${id}`
  );
  return data;
}

export async function importarNfEntradaXml(file: File, empresaId: string, filialId?: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('empresaId', empresaId);
  if (filialId) form.append('filialId', filialId);
  const { data } = await api.post<{ id: string; message: string; fornecedor_vinculado: boolean; assinatura_valida: boolean }>(
    '/tenant/entrada/nf-entradas/importar-xml',
    form
  );
  return data;
}

export async function gerarContasPagar(nfEntradaId: string, categoria?: string) {
  const { data } = await api.post<{ ids: string[]; message: string }>(
    `/tenant/entrada/nf-entradas/${nfEntradaId}/gerar-contas-pagar`,
    { categoria: categoria || undefined }
  );
  return data;
}

export async function vincularFornecedor(nfEntradaId: string, fornecedorId: string) {
  const { data } = await api.patch(`/tenant/entrada/nf-entradas/${nfEntradaId}`, { fornecedorId });
  return data;
}

// ─── Distribuição DFe ────────────────────────────────────────────────────────

export interface DfeSyncStatus {
  ult_nsu: string;
  max_nsu: string | null;
  ultima_consulta_em: string | null;
  ultimo_status: 'ok' | 'erro' | null;
  ultimo_erro: string | null;
}

export interface DfeDocumento {
  id: string;
  nsu: string;
  schema_doc: string;
  tipo: 'resumo' | 'nfe_completa' | 'evento';
  chave_acesso: string | null;
  emitente_cnpj: string | null;
  emitente_nome: string | null;
  valor_total: number | null;
  dh_emissao: string | null;
  status: 'novo' | 'importada' | 'ignorada';
  created_at: string;
}

export async function dfeConsultar(empresaId: string) {
  const { data } = await api.post<{
    cStat: string; xMotivo: string; documentos_novos: number;
    ult_nsu: string; max_nsu: string; ha_mais: boolean; message: string;
  }>('/tenant/entrada/dfe/consultar', { empresaId });
  return data;
}

export async function dfeStatus(empresaId: string) {
  const { data } = await api.get<{ sync: DfeSyncStatus | null }>('/tenant/entrada/dfe/status', {
    params: { empresaId },
  });
  return data.sync;
}

export async function dfeListarDocumentos(empresaId: string, status?: string) {
  const { data } = await api.get<{ documentos: DfeDocumento[] }>('/tenant/entrada/dfe/documentos', {
    params: { empresaId, ...(status ? { status } : {}) },
  });
  return data.documentos;
}

export async function dfeBaixarXml(doc: DfeDocumento): Promise<void> {
  const res = await api.get(`/tenant/entrada/dfe/documentos/${doc.id}/xml`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.chave_acesso ?? doc.nsu}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function dfeAtualizarStatus(id: string, status: 'novo' | 'importada' | 'ignorada') {
  const { data } = await api.post(`/tenant/entrada/dfe/documentos/${id}/status`, { status });
  return data;
}

/** Importa uma NF-e completa (procNFe) do DFe no fluxo padrão de entrada. */
export async function dfeImportarNoErp(doc: DfeDocumento, empresaId: string) {
  const res = await api.get(`/tenant/entrada/dfe/documentos/${doc.id}/xml`, { responseType: 'blob' });
  const file = new File([res.data as Blob], `${doc.chave_acesso ?? doc.nsu}.xml`, { type: 'application/xml' });
  const resultado = await importarNfEntradaXml(file, empresaId);
  await dfeAtualizarStatus(doc.id, 'importada');
  return resultado;
}
