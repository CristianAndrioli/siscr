import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  saveGridPreferences,
  loadGridPreferences,
  clearGridPreferences,
  DEFAULT_GRID_PAGE_SIZE,
  GRID_PAGE_SIZE_OPTIONS,
  type GridSort,
} from '../../utils/gridPreferences';

// ─── Column definition ────────────────────────────────────────────────────────

export interface SmartColumn<T = object> {
  key: string;
  label: string;
  width?: number;
  minWidth?: number;
  sortable?: boolean;      // default: true
  filterable?: boolean;    // default: true
  required?: boolean;      // always visible, cannot be hidden
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T) => React.ReactNode;
}

// ─── Props ────────────────────────────────────────────────────────────────────

/** Paginação no servidor: `data` deve conter só a página actual. */
export interface SmartGridServerPagination {
  total: number;
  /** 0-based */
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Deve repor a página para 0 quando o tamanho mudar (evita pedidos duplicados). */
  onPageSizeChange: (pageSize: number) => void;
  options?: readonly number[];
}

interface SmartGridProps<T extends object> {
  gridId: string;
  data: T[];
  columns: SmartColumn<T>[];
  defaultSort?: GridSort;
  onRowClick?: (row: T) => void;
  onCreate?: () => void;
  createLabel?: string;
  loading?: boolean;
  emptyMessage?: string;
  /** Render custom action buttons per row (receives the row, should stopPropagation) */
  actions?: (row: T) => React.ReactNode;
  /** Optional extra CSS class for a row */
  getRowClass?: (row: T) => string;
  /**
   * Lista paginada no servidor. Desactiva filtros por coluna (dados incompletos).
   * Persiste `pageSize` e `listPage` nas preferências da grelha.
   */
  serverPagination?: SmartGridServerPagination;
}

// ─── Icons (inline SVG helpers) ───────────────────────────────────────────────

const IconSort = ({ dir }: { dir: 'asc' | 'desc' | null }) => (
  <span className="inline-flex flex-col ml-1 gap-0.5 leading-none text-[10px]">
    <span className={dir === 'asc' ? 'text-brand-500' : 'text-slate-300 dark:text-slate-600'}>▲</span>
    <span className={dir === 'desc' ? 'text-brand-500' : 'text-slate-300 dark:text-slate-600'}>▼</span>
  </span>
);

const IconColumns = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M3 9h18M3 15h18" />
  </svg>
);

const IconFilter = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25m5.25-.75L17.25 9m0 0L21 12.75M17.25 9v12" />
  </svg>
);

const IconReset = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
  </svg>
);

const IconDelete = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export function SmartGrid<T extends object>({
  gridId,
  data,
  columns,
  defaultSort,
  onRowClick,
  onCreate,
  createLabel = 'Novo',
  loading = false,
  emptyMessage = 'Nenhum registro encontrado.',
  actions,
  getRowClass,
  serverPagination,
}: SmartGridProps<T>) {
  const pageSizeOptions = serverPagination?.options ?? GRID_PAGE_SIZE_OPTIONS;
  // ── State ──────────────────────────────────────────────────────────────────

  const [sort, setSort] = useState<GridSort | null>(defaultSort ?? null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [showColumnModal, setShowColumnModal] = useState(false);

  // Column order: array of column keys
  const [columnOrder, setColumnOrder] = useState<string[]>(() => columns.map(c => c.key));
  // Column widths overrides
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  // Visible columns
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => columns.map(c => c.key));

  // Drag-to-reorder
  const dragKeyRef = useRef<string | null>(null);

  // Column resize
  const resizingRef = useRef<{ key: string; startX: number; startW: number } | null>(null);

  // Preferences loaded flag
  const prefsLoaded = useRef(false);

  // ── Load preferences on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (prefsLoaded.current) return;
    prefsLoaded.current = true;

    const prefs = loadGridPreferences(gridId);
    if (!prefs) return;

    if (prefs.sort !== undefined) setSort(prefs.sort ?? null);
    if (prefs.filters) setFilters(prefs.filters);
    if (prefs.columnWidths) setColumnWidths(prefs.columnWidths);

    const allKeys = columns.map(c => c.key);
    const requiredKeys = columns.filter(c => c.required).map(c => c.key);

    if (prefs.columnOrder?.length) {
      // Keep order but include any new columns not in saved prefs
      const saved = prefs.columnOrder.filter(k => allKeys.includes(k));
      const added = allKeys.filter(k => !saved.includes(k));
      setColumnOrder([...saved, ...added]);
    }

    if (prefs.visibleColumns?.length) {
      const visible = [...new Set([...requiredKeys, ...prefs.visibleColumns.filter(k => allKeys.includes(k))])];
      setVisibleColumns(visible);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridId]);

  // ── Save preferences on change ─────────────────────────────────────────────

  const savePrefs = useCallback(() => {
    saveGridPreferences(gridId, {
      sort,
      filters,
      columnOrder,
      columnWidths,
      visibleColumns,
      ...(serverPagination != null
        ? { pageSize: serverPagination.pageSize, listPage: serverPagination.page }
        : {}),
    });
  }, [
    gridId,
    sort,
    filters,
    columnOrder,
    columnWidths,
    visibleColumns,
    serverPagination?.page,
    serverPagination?.pageSize,
  ]);

  useEffect(() => {
    if (!prefsLoaded.current) return;
    savePrefs();
  }, [savePrefs]);

  // ── Derived columns ────────────────────────────────────────────────────────

  const orderedVisibleColumns = useMemo(() => {
    const colMap = Object.fromEntries(columns.map(c => [c.key, c]));
    return columnOrder
      .filter(k => visibleColumns.includes(k))
      .map(k => colMap[k])
      .filter(Boolean) as SmartColumn<T>[];
  }, [columns, columnOrder, visibleColumns]);

  // ── Filtering (client-side per column) ────────────────────────────────────

  const filteredData = useMemo(() => {
    if (serverPagination) return data;

    const activeFilters = Object.entries(filters).filter(([, v]) => v.trim() !== '');
    if (!activeFilters.length) return data;

    return data.filter(row =>
      activeFilters.every(([key, val]) => {
        const cell = (row as Record<string, unknown>)[key];
        if (cell === null || cell === undefined) return false;
        return String(cell).toLowerCase().includes(val.toLowerCase());
      }),
    );
  }, [data, filters, serverPagination]);

  // ── Sorting (client-side) ─────────────────────────────────────────────────

  const sortedData = useMemo(() => {
    if (!sort) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sort.key];
      const bVal = (b as Record<string, unknown>)[sort.key];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const aNum = Number(aVal);
      const bNum = Number(bVal);
      const numericCmp = !isNaN(aNum) && !isNaN(bNum) ? aNum - bNum : String(aVal).localeCompare(String(bVal), 'pt-BR');

      return sort.dir === 'asc' ? numericCmp : -numericCmp;
    });
  }, [filteredData, sort]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSort = (key: string) => {
    setSort(prev => {
      if (prev?.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return defaultSort ?? null; // cycle back to default
    });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    clearGridPreferences(gridId);
    setSort(defaultSort ?? null);
    setFilters({});
    setColumnOrder(columns.map(c => c.key));
    setColumnWidths({});
    setVisibleColumns(columns.map(c => c.key));
    setShowFilters(false);
    if (serverPagination) {
      serverPagination.onPageChange(0);
      serverPagination.onPageSizeChange(DEFAULT_GRID_PAGE_SIZE);
    }
  };

  // Drag reorder
  const handleDragStart = (key: string) => { dragKeyRef.current = key; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDrop = (targetKey: string) => {
    const fromKey = dragKeyRef.current;
    if (!fromKey || fromKey === targetKey) return;
    setColumnOrder(prev => {
      const next = [...prev];
      const fromIdx = next.indexOf(fromKey);
      const toIdx = next.indexOf(targetKey);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromKey);
      return next;
    });
    dragKeyRef.current = null;
  };

  // Column resize
  const handleResizeMouseDown = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    const col = columns.find(c => c.key === key);
    const startW = columnWidths[key] ?? col?.width ?? 150;
    resizingRef.current = { key, startX: e.clientX, startW };

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const { key: k, startX, startW: sw } = resizingRef.current;
      const col = columns.find(c => c.key === k);
      const newW = Math.max(col?.minWidth ?? 60, sw + ev.clientX - startX);
      setColumnWidths(prev => ({ ...prev, [k]: newW }));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const getWidth = (key: string) => {
    const col = columns.find(c => c.key === key);
    return columnWidths[key] ?? col?.width ?? 150;
  };

  const hasActiveFilters = Object.values(filters).some(v => v.trim() !== '');
  const activeFilterCount = Object.values(filters).filter(v => v.trim() !== '').length;

  const pageCount =
    serverPagination != null
      ? Math.max(1, Math.ceil(serverPagination.total / Math.max(serverPagination.pageSize, 1)))
      : 1;
  const canPrevPage = serverPagination != null && serverPagination.page > 0;
  const canNextPage = serverPagination != null && serverPagination.page < pageCount - 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex-wrap">
        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
          {serverPagination ? (
            <>
              Página {serverPagination.page + 1} de {pageCount} · {serverPagination.total} registro
              {serverPagination.total !== 1 ? 's' : ''} no servidor
              {sortedData.length !== serverPagination.pageSize && sortedData.length > 0
                ? ` (${sortedData.length} nesta página)`
                : ''}
            </>
          ) : (
            <>
              {sortedData.length} registro{sortedData.length !== 1 ? 's' : ''}
              {data.length !== sortedData.length ? ` de ${data.length}` : ''}
            </>
          )}
        </span>

        <div className="flex-1" />

        {/* Filter toggle — só modo cliente (página completa em memória) */}
        {!serverPagination && (
          <button
            onClick={() => setShowFilters(f => !f)}
            title="Filtros por coluna"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              showFilters || hasActiveFilters
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border-brand-200 dark:border-brand-700'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <IconFilter />
            Filtros
            {activeFilterCount > 0 && (
              <span className="bg-brand-500 text-white rounded-full px-1.5 text-[10px] leading-4">{activeFilterCount}</span>
            )}
          </button>
        )}

        {/* Columns toggle */}
        <button
          onClick={() => setShowColumnModal(true)}
          title="Colunas visíveis"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <IconColumns />
          Colunas
        </button>

        {/* Reset */}
        <button
          onClick={handleReset}
          title="Redefinir grid (limpar filtros, ordenação e layout)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <IconReset />
          Reset
        </button>

        {/* New */}
        {onCreate && (
          <button
            onClick={onCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {createLabel}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: orderedVisibleColumns.reduce((s, c) => s + getWidth(c.key), 0) + (actions ? 80 : 0) }}>
          <colgroup>
            {orderedVisibleColumns.map(col => (
              <col key={col.key} style={{ width: getWidth(col.key) }} />
            ))}
            {actions && <col style={{ width: 80 }} />}
          </colgroup>

          <thead>
            {/* Header row */}
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
              {orderedVisibleColumns.map(col => (
                <th
                  key={col.key}
                  className={`relative px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide select-none cursor-grab active:cursor-grabbing ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.sortable !== false ? 'hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer' : ''}`}
                  draggable
                  onDragStart={() => handleDragStart(col.key)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(col.key)}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{ width: getWidth(col.key) }}
                >
                  <span className="flex items-center gap-0.5 truncate">
                    {col.label}
                    {col.sortable !== false && (
                      <IconSort dir={sort?.key === col.key ? sort.dir : null} />
                    )}
                  </span>

                  {/* Resize handle */}
                  <div
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-brand-400/40 dark:hover:bg-brand-600/40"
                    onMouseDown={e => handleResizeMouseDown(e, col.key)}
                    onClick={e => e.stopPropagation()}
                    draggable={false}
                  />
                </th>
              ))}
              {actions && (
                <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide text-right">
                  Ações
                </th>
              )}
            </tr>

            {/* Filter row */}
            {showFilters && !serverPagination && (
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                {orderedVisibleColumns.map(col => (
                  <td key={col.key} className="px-2 py-1.5">
                    {col.filterable !== false ? (
                      <input
                        type="text"
                        value={filters[col.key] ?? ''}
                        onChange={e => handleFilterChange(col.key, e.target.value)}
                        placeholder={`Filtrar…`}
                        className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded px-2 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-brand-400"
                      />
                    ) : (
                      <span />
                    )}
                  </td>
                ))}
                {actions && <td />}
              </tr>
            )}
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr>
                <td colSpan={orderedVisibleColumns.length + (actions ? 1 : 0)} className="py-16 text-center">
                  <svg className="animate-spin w-6 h-6 text-brand-500 mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={orderedVisibleColumns.length + (actions ? 1 : 0)} className="py-14 text-center text-slate-400 dark:text-slate-500 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, idx) => {
                const rid = (row as Record<string, unknown>).id;
                const rowKey = rid != null && rid !== '' ? String(rid) : idx;
                const extraClass = getRowClass ? getRowClass(row) : '';
                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick?.(row)}
                    className={`transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50' : ''} ${extraClass}`}
                  >
                    {orderedVisibleColumns.map(col => (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 text-slate-700 dark:text-slate-200 overflow-hidden ${
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                        style={{ maxWidth: getWidth(col.key) }}
                      >
                        <div className="truncate">
                          {col.render
                            ? col.render((row as Record<string, unknown>)[col.key], row)
                            : ((row as Record<string, unknown>)[col.key] !== null &&
                                (row as Record<string, unknown>)[col.key] !== undefined
                                ? String((row as Record<string, unknown>)[col.key])
                                : '—')}
                        </div>
                      </td>
                    ))}
                    {actions && (
                      <td
                        className="px-3 py-2.5 text-right"
                        onClick={e => e.stopPropagation()}
                      >
                        {actions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {serverPagination && (
        <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60 dark:bg-slate-800/40">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canPrevPage || loading}
              onClick={() => serverPagination.onPageChange(serverPagination.page - 1)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!canNextPage || loading}
              onClick={() => serverPagination.onPageChange(serverPagination.page + 1)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
            >
              Seguinte
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>Por página</span>
            <select
              value={serverPagination.pageSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                serverPagination.onPageSizeChange(n);
              }}
              className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Registos por página"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Column visibility modal */}
      {showColumnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 w-80 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">Colunas visíveis</h3>
              <button onClick={() => setShowColumnModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
              {columns.map(col => {
                const isRequired = col.required;
                const isVisible = visibleColumns.includes(col.key);
                return (
                  <label
                    key={col.key}
                    className={`flex items-center gap-3 p-2 rounded-lg ${isRequired ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      disabled={isRequired}
                      onChange={() => {
                        if (isRequired) return;
                        setVisibleColumns(prev =>
                          prev.includes(col.key) ? prev.filter(k => k !== col.key) : [...prev, col.key],
                        );
                      }}
                      className="w-4 h-4 rounded accent-brand-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{col.label}</span>
                    {isRequired && <span className="text-xs text-slate-400 ml-auto">obrigatória</span>}
                  </label>
                );
              })}
            </div>
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 justify-end">
              <button
                onClick={() => setVisibleColumns(columns.map(c => c.key))}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                Mostrar todas
              </button>
              <button
                onClick={() => setShowColumnModal(false)}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Delete action helper ─────────────────────────────────────────────────────

interface DeleteBtnProps {
  onClick: (e: React.MouseEvent) => void;
  title?: string;
}

export function GridDeleteBtn({ onClick, title = 'Excluir' }: DeleteBtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1 rounded"
    >
      <IconDelete />
    </button>
  );
}

export default SmartGrid;
