import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import * as entradaService from '../../services/entradaService';
import { fmtBRL, fmtDate } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

interface EmpresaRow {
  id: string;
  razao_social: string;
}

export default function NfEntradaList() {
  const { reportError } = useErrorNotification();
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [entradas, setEntradas] = useState<entradaService.NfEntradaListItem[]>([]);
  const [total, setTotal] = useState(0);

  const loadMeta = useCallback(async () => {
    try {
      const eRes = await api.get('/tenant/info/empresas');
      const elist = (eRes.data.empresas ?? []) as EmpresaRow[];
      setEmpresas(elist);
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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notas importadas</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            NF-e de compra já gravadas no sistema. Para nova importação use o assistente.
          </p>
        </div>
        <Link
          to="/entrada/nf-e/nova"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-sm"
        >
          Nova importação assistida
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
          Filtrar por empresa:
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            className="border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-950"
          >
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.razao_social}
              </option>
            ))}
          </select>
        </label>
        <span className="text-xs text-slate-400">{total} registro(s)</span>
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Carregando…</p>
      ) : entradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
          <p className="mb-4">Nenhuma NF-e de entrada ainda.</p>
          <Link to="/entrada/nf-e/nova" className="text-brand-600 font-medium hover:underline">
            Abrir assistente de importação
          </Link>
        </div>
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
                    <div className="text-xs text-slate-500">
                      {n.fornecedor_nome ? `Cadastro: ${n.fornecedor_nome}` : 'Fornecedor não vinculado'}
                    </div>
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
  );
}
