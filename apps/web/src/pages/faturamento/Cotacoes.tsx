import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  cotacoesService,
  type Cotacao,
  type CotacaoResumoStatus,
  type CotacaoStatus,
  type CotacaoTipo,
} from '../../services/faturamentoService';
import api from '../../services/api';
import { fmtBRL } from '../../utils/format';
import { formatApiError } from '../../utils/helpers';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

const STATUS_STYLE: Record<CotacaoStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  enviada: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  aprovada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  recusada: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  expirada: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
};
const STATUS_LABEL: Record<CotacaoStatus, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  expirada: 'Expirada',
};

const PAGE_SIZE = 50;

interface EmpresaRow {
  id: string;
  razao_social: string;
}

interface CotacoesPageProps {
  tipo: CotacaoTipo;
  titulo: string;
  descricao: string;
  pessoaLabel: string;
  basePath: string;
}

function CotacoesPageBase({ tipo, titulo, descricao, pessoaLabel, basePath }: CotacoesPageProps) {
  const navigate = useNavigate();
  const { reportError } = useErrorNotification();
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [resumo, setResumo] = useState<CotacaoResumoStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [empresaFiltro, setEmpresaFiltro] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<CotacaoStatus | ''>('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 300);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
  }, [buscaDebounced, statusFiltro, tipo, empresaFiltro]);

  useEffect(() => {
    api
      .get('/tenant/info/empresas')
      .then((r) => setEmpresas((r.data.empresas ?? []) as EmpresaRow[]))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await cotacoesService.list({
        tipo,
        status: statusFiltro || undefined,
        busca: buscaDebounced || undefined,
        empresaId: empresaFiltro || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setCotacoes(data.cotacoes);
      setTotal(data.total);
      setResumo(data.resumo);
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao carregar cotações.');
      reportError(msg, err, 'Cotação');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [tipo, statusFiltro, buscaDebounced, empresaFiltro, page, reportError]);

  useEffect(() => {
    void load();
  }, [load]);

  const qtdPorStatus = useMemo(() => {
    const map: Record<string, number> = {};
    let valorAprovadas = 0;
    for (const r of resumo) {
      map[r.status] = r.quantidade;
      if (r.status === 'aprovada') valorAprovadas = r.valor_total;
    }
    return {
      total: resumo.reduce((s, r) => s + r.quantidade, 0),
      aprovadasValor: valorAprovadas,
      enviada: map.enviada ?? 0,
      rascunho: map.rascunho ?? 0,
    };
  }, [resumo]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allPageSelected = cotacoes.length > 0 && cotacoes.every((c) => selectedIds.has(c.id));

  const toggleSelect = (cid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const c of cotacoes) next.delete(c.id);
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const c of cotacoes) next.add(c.id);
        return next;
      });
    }
  };

  const handleBulkStatus = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    setBulkBusy(true);
    setError('');
    try {
      await cotacoesService.updateStatusBatch([...selectedIds], bulkStatus);
      setSelectedIds(new Set());
      setBulkStatus('');
      await load();
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao alterar status em massa.');
      reportError(msg, err, 'Cotação');
      setError(msg);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleQuickStatus = async (cid: string, novoStatus: CotacaoStatus) => {
    try {
      await cotacoesService.updateStatusBatch([cid], novoStatus);
      setCotacoes((prev) => prev.map((c) => (c.id === cid ? { ...c, status: novoStatus } : c)));
      await load();
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao alterar status.');
      reportError(msg, err, 'Cotação');
      setError(msg);
    }
  };

  const openDetail = (cid: string) => navigate(`${basePath}/${cid}`);
  const openNew = () => navigate(`${basePath}/nova`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">{titulo}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{descricao}</p>
        </div>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Cotação
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(
          [
            ['Total', qtdPorStatus.total, ''],
            ['Aprovadas', fmtBRL(qtdPorStatus.aprovadasValor), 'text-emerald-600 dark:text-emerald-400'],
            ['Aguardando', qtdPorStatus.enviada, 'text-blue-600 dark:text-blue-400'],
            ['Rascunhos', qtdPorStatus.rascunho, ''],
          ] as const
        ).map(([label, val, cls]) => (
          <div
            key={label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
          >
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {label}
            </p>
            <p className={`text-xl font-bold mt-1 text-slate-800 dark:text-slate-100 ${cls}`}>{val}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={`Buscar por ${pessoaLabel.toLowerCase()} ou número...`}
          className="flex-1 min-w-[200px] border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={empresaFiltro}
          onChange={(e) => setEmpresaFiltro(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">Todas as empresas</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.razao_social}
            </option>
          ))}
        </select>
        <select
          value={statusFiltro}
          onChange={(e) => setStatusFiltro(e.target.value)}
          className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-brand-800 dark:text-brand-200">
            {selectedIds.size} selecionada(s)
          </span>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as CotacaoStatus | '')}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Alterar status para…</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!bulkStatus || bulkBusy}
            onClick={handleBulkStatus}
            className="px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {bulkBusy ? 'Aplicando…' : 'Aplicar'}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedIds(new Set());
              setBulkStatus('');
            }}
            className="text-sm text-slate-500 hover:underline"
          >
            Limpar seleção
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        ) : cotacoes.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
            Nenhuma cotação encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAllPage}
                      aria-label="Selecionar página"
                      className="rounded border-slate-300"
                    />
                  </th>
                  {['Número', pessoaLabel, 'Empresa', 'Validade', 'Total', 'Status', 'Criado em', ''].map(
                    (h) => (
                      <th
                        key={h || 'acoes'}
                        className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {cotacoes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        aria-label={`Selecionar ${c.numero}`}
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-xs font-bold text-brand-600 dark:text-brand-400 cursor-pointer"
                      onClick={() => openDetail(c.id)}
                    >
                      {c.numero}
                    </td>
                    <td
                      className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100 cursor-pointer"
                      onClick={() => openDetail(c.id)}
                    >
                      {c.cliente || (
                        <span className="text-slate-400 italic">Sem {pessoaLabel.toLowerCase()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      <div className="font-medium text-slate-700 dark:text-slate-200">
                        {c.empresa_nome || '—'}
                      </div>
                      <div>{c.filial_nome || 'Matriz'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {fmtDate(c.validade)}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                      {fmtBRL(c.valor_total)}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={c.status}
                        onChange={(e) => handleQuickStatus(c.id, e.target.value as CotacaoStatus)}
                        className={`border-0 rounded-full text-xs font-semibold px-2.5 py-1 cursor-pointer focus:ring-2 focus:ring-brand-500 ${STATUS_STYLE[c.status]}`}
                        title="Alterar status sem abrir a cotação"
                      >
                        {Object.entries(STATUS_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">
                      {fmtDate(c.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {tipo === 'venda' && c.status === 'aprovada' && (
                          <button
                            type="button"
                            onClick={() => navigate(`/faturamento/nf-venda/nova?cotacaoId=${c.id}`)}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                          >
                            Faturar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openDetail(c.id)}
                          className="text-xs text-slate-500 hover:underline font-medium"
                        >
                          Abrir
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(c.id)}
                          className="text-xs text-red-500 hover:underline font-medium"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              {total} cotação(ões) · página {page + 1} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Excluir cotação?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await cotacoesService.delete(deleteConfirm!);
                    setDeleteConfirm(null);
                    await load();
                  } catch (err) {
                    const msg = formatApiError(err, 'Erro ao excluir cotação.');
                    reportError(msg, err, 'Cotação');
                    setError(msg);
                    setDeleteConfirm(null);
                  }
                }}
                className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CotacoesPage() {
  return (
    <CotacoesPageBase
      tipo="venda"
      titulo="Cotações"
      descricao="Propostas comerciais para clientes — controle de status e faturamento"
      pessoaLabel="Cliente"
      basePath="/faturamento/cotacoes"
    />
  );
}

export function CotacoesFornecedorPage() {
  return (
    <CotacoesPageBase
      tipo="compra"
      titulo="Cotações de Fornecedores"
      descricao="Pedido de cotação (RFQ) para fornecedores"
      pessoaLabel="Fornecedor"
      basePath="/compras/cotacoes"
    />
  );
}

export default CotacoesPage;
