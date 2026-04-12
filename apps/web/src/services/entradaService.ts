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
  descricao: string;
  quantidade: number;
  valorTotal: number;
  cfop?: string;
  ncm?: string;
  unidade?: string;
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
