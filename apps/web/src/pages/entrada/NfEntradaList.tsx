import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import * as entradaService from '../../services/entradaService';
import { fmtBRL, fmtDate } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

interface EmpresaRow {
  id: string;
  razao_social: string;
  cnpj?: string;
}

interface FilialRow {
  id: string;
  nome: string;
  empresa_id: string;
}

export default function NfEntradaList() {
  const { reportError } = useErrorNotification();
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [filiais, setFiliais] = useState<FilialRow[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [filialId, setFilialId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [entradas, setEntradas] = useState<entradaService.NfEntradaListItem[]>([]);
  const [total, setTotal] = useState(0);

  const loadMeta = useCallback(async () => {
    try {
      const [eRes, fRes] = await Promise.all([
        api.get('/tenant/info/empresas'),
        api.get('/tenant/info/filiais'),
      ]);
      const elist = (eRes.data.empresas ?? []) as EmpresaRow[];
      const flist = (fRes.data.filiais ?? []) as FilialRow[];
      setEmpresas(elist);
      setFiliais(flist);
      setEmpresaId((prev) => prev || elist[0]?.id || '');
    } catch {
      reportError('Não foi possível carregar empresas.');
    }
  }, [reportError]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await entradaService.listNfEntradas({ empresaId: empresaId || undefined, limit: 100, page: 0 });
      setEntradas(r.entradas ?? []);
      setTotal(r.total ?? 0);
    } catch {
      reportError('Erro ao listar notas de entrada.');
    } finally {
      setLoading(false);
    }
  }, [empresaId, reportError]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (empresaId) loadList();
  }, [empresaId, loadList]);

  const filiaisFiltradas = filiais.filter((f) => f.empresa_id === empresaId);

  const handleImport = async () => {
    if (!file || !empresaId) {
      reportError('Selecione o XML e a empresa (destinatário da NF-e).');
      return;
    }
    setImporting(true);
    try {
      const r = await entradaService.importarNfEntradaXml(file, empresaId, filialId || undefined);
      let msg = r.message;
      if (!r.fornecedor_vinculado) msg += ' Cadastre o fornecedor com o CNPJ do emitente para gerar contas a pagar.';
      if (!r.assinatura_valida) msg += ' Atenção: assinatura digital não validada ou ausente.';
      window.alert(msg);
      setFile(null);
      await loadList();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string }; status?: number } };
      const err = ax.response?.data?.error || 'Falha na importação.';
      if (ax.response?.status === 409 && ax.response?.data && typeof ax.response.data === 'object' && 'id' in ax.response.data) {
        reportError('Esta NF-e já foi importada.');
      } else {
        reportError(err);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">NF-e de entrada</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Importe XML de compra (destinatário = sua empresa) e gere contas a pagar.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-amber-50/80 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-950 dark:text-amber-200">
        <p className="font-semibold mb-1">Como funciona na prática</p>
        <ul className="list-disc pl-5 space-y-1 text-amber-900/90 dark:text-amber-100/90">
          <li>
            <strong>Importação manual de XML</strong> é o caminho mais comum: você recebe o arquivo do fornecedor, do e-mail ou baixa após{' '}
            <strong>manifestação do destinatário</strong> (ciência/confirmação) no portal da SEFAZ ou no ERP.
          </li>
          <li>
            <strong>Busca automática</strong> de notas para o seu CNPJ usa o serviço nacional <strong>Distribuição DF-e</strong> (NSU, certificado A1,
            manifestação). É o padrão em sistemas maduros, mas exige integração SOAP dedicada —{' '}
            <span className="font-medium">ainda não disponível nesta versão</span>.
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Importar XML</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          O destinatário no XML deve ser o <strong>CNPJ da empresa</strong> selecionada. O sistema valida antes de gravar.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Empresa (destinatário)</span>
            <select
              value={empresaId}
              onChange={(e) => {
                setEmpresaId(e.target.value);
                setFilialId('');
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.razao_social}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Filial (opcional)</span>
            <select
              value={filialId}
              onChange={(e) => setFilialId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              {filiaisFiltradas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Arquivo XML (NF-e autorizada)</span>
          <input
            type="file"
            accept=".xml,text/xml,application/xml"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm text-slate-600 dark:text-slate-400"
          />
        </label>
        <button
          type="button"
          disabled={importing || !file}
          onClick={handleImport}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium"
        >
          {importing ? 'Importando…' : 'Importar'}
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Notas importadas</h2>
          <span className="text-xs text-slate-500">{total} registro(s)</span>
        </div>
        {loading ? (
          <p className="text-slate-500 text-sm">Carregando…</p>
        ) : entradas.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhuma NF-e de entrada ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Emissão</th>
                  <th className="px-4 py-2">Fornecedor</th>
                  <th className="px-4 py-2">Nº / Série</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {entradas.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2 whitespace-nowrap">{n.data_emissao ? fmtDate(n.data_emissao) : '—'}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{n.emitente_nome || n.emitente_cnpj}</div>
                      <div className="text-xs text-slate-500">{n.fornecedor_nome ? `Cadastro: ${n.fornecedor_nome}` : 'Fornecedor não vinculado'}</div>
                    </td>
                    <td className="px-4 py-2">
                      {n.numero ?? '—'} / {n.serie ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtBRL(n.valor_total)}</td>
                    <td className="px-4 py-2 text-right">
                      <Link
                        to={`/entrada/notas/${n.id}`}
                        className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
