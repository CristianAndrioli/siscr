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
  fornecedor_id: string | null;
  created_at: string;
  fornecedor_nome?: string | null;
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
}

export async function previewNfEntradaXml(file: File, empresaId: string) {
  const form = new FormData();
  form.append('file', file);
  form.append('empresaId', empresaId);
  const { data } = await api.post<{
    parsed: unknown;
    sugestoes: { indice: number; produtoId: string | null; motivo: string; rotulo?: string }[];
    assinatura_valida: boolean;
    fornecedor_id: string | null;
    fornecedor_sera_cadastrado?: boolean;
    nfce_sem_dest?: boolean;
    import_kind?: 'nfe' | 'nfce';
    modelo_fiscal?: number;
    fiscal_xml_family?: string;
  }>('/tenant/entrada/nf-entradas/preview-xml', form);
  return data;
}

export async function confirmarNfEntradaImport(payload: {
  xmlBase64: string;
  empresaId: string;
  filialId?: string | null;
  vinculos: { indice: number; produtoId?: string; criar?: boolean }[];
  /** Obrigatório quando o preview indica NFC-e sem grupo dest no XML. */
  confirmarDestinoEmpresa?: boolean;
}) {
  const { data } = await api.post<{ id: string; message: string; fornecedor_vinculado: boolean; assinatura_valida: boolean }>(
    '/tenant/entrada/nf-entradas/confirmar',
    payload
  );
  return data;
}

export async function listNfEntradas(params?: { empresaId?: string; filialId?: string; page?: number; limit?: number }) {
  const { data } = await api.get<{ entradas: NfEntradaListItem[]; total: number; page: number; limit: number }>(
    '/tenant/entrada/nf-entradas',
    { params }
  );
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
