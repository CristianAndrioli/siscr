import { useState, useEffect, useCallback } from 'react';
import { estoqueService, type ItemEstoque } from '../../services/estoqueService';
import SmartGrid, { type SmartColumn } from '../../components/common/SmartGrid';
import {
  loadGridListPage,
  loadGridPreferences,
  normalizeGridPageSize,
  type GridPageSize,
} from '../../utils/gridPreferences';

const GRID_ID = 'estoque-atual-list';

const fmtQtd = (v: number) =>
  Number(v ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const TIPO_COLOR: Record<string, string> = {
  GERAL: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  ALMOXARIFADO: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  LOJA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  ARMAZEM: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  DEPOSITO: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  EXTERNO: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300',
};

const COLUMNS: SmartColumn<ItemEstoque>[] = [
  { key: 'produto', label: 'Produto', width: 240, required: true,
    render: v => <span className="font-medium text-slate-800 dark:text-slate-100">{String(v ?? '—')}</span> },
  { key: 'codigo', label: 'Código', width: 90,
    render: v => <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{v != null && v !== '' ? String(v) : '—'}</span> },
  { key: 'location', label: 'Local', width: 140,
    render: v => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${TIPO_COLOR[String(v)] ?? TIPO_COLOR.GERAL}`}>
        {String(v ?? '—')}
      </span>
    ) },
  { key: 'unidade', label: 'Unid.', width: 70 },
  { key: 'quantidade', label: 'Quantidade', width: 110, align: 'right',
    render: (v, row) => (
      <span className={`font-bold tabular-nums ${Number(v) <= 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-100'}`}>
        {fmtQtd(Number(v ?? 0))}
        {row.unidade && <span className="ml-1 text-xs text-slate-400">{String(row.unidade)}</span>}
      </span>
    ) },
  { key: 'updated_at', label: 'Atualizado', width: 110, filterable: false,
    render: v => <span className="text-xs text-slate-400 dark:text-slate-500">{v ? new Date(String(v)).toLocaleDateString('pt-BR') : '—'}</span> },
];

export function EstoqueAtualList() {
  const [itens, setItens] = useState<ItemEstoque[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => loadGridListPage(GRID_ID));
  const [pageSize, setPageSize] = useState<GridPageSize>(() =>
    normalizeGridPageSize(loadGridPreferences(GRID_ID)?.pageSize),
  );
  const [meta, setMeta] = useState({ com_saldo: 0, zerados: 0, locais: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await estoqueService.posicao({ page, limit: pageSize });
      setItens(r.estoque);
      setTotal(r.total);
      setMeta(r.meta);
      const maxPage = Math.max(0, Math.ceil(r.total / Math.max(r.limit, 1)) - 1);
      if (page > maxPage) setPage(maxPage);
    } catch {
      setError('Erro ao carregar posição de estoque.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const comSaldo = meta.com_saldo;
  const totalZerado = meta.zerados;
  const locaisCount = meta.locais;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Posição Atual</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Saldo de estoque por produto e local</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Com saldo</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{comSaldo}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Locais</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 mt-1">{locaisCount}</p>
        </div>
        {totalZerado > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Zerados/Negativos</p>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{totalZerado}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <SmartGrid<ItemEstoque>
        gridId={GRID_ID}
        data={itens}
        columns={COLUMNS}
        defaultSort={{ key: 'produto', dir: 'asc' }}
        loading={loading}
        emptyMessage="Nenhum item de estoque. Registre uma entrada em Movimentações."
        getRowClass={row => row.quantidade <= 0 ? 'bg-red-50/30 dark:bg-red-950/20' : ''}
        serverPagination={{
          total,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (n) => {
            setPageSize(normalizeGridPageSize(n));
            setPage(0);
          },
        }}
      />
    </div>
  );
}

export default EstoqueAtualList;
