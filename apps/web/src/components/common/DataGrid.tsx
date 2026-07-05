import { useState, useMemo, useRef, useEffect, MouseEvent } from 'react';
import Button from './Button';
import Modal from './Modal';
import { saveGridPreferences, loadGridPreferences } from '../../utils/gridPreferences';
import type { GridColumn, Pagination } from '../../types';

interface DataGridProps<T = unknown> {
  data?: T[];
  columns?: GridColumn[];
  onRowClick?: (record: T) => void;
  onSearch?: (searchTerm: string) => void;
  onCreate?: () => void;
  onDelete?: (record: T) => void;
  onEdit?: (record: T) => void;
  loading?: boolean;
  pagination?: Pagination & { onPageChange?: (page: number) => void };
  searchPlaceholder?: string;
  emptyMessage?: string;
  gridId?: string;
  showActions?: boolean;
  getRowClassName?: (record: T) => string;
}

/**
 * DataGrid - Componente reutilizável para exibir dados em tabela
 * Inspirado no Salesforce, com pesquisa, ordenação, paginação, personalização de colunas e ações rápidas
 */
export function DataGrid<T extends Record<string, unknown> = Record<string, unknown>>({
  data = [],
  columns = [],
  onRowClick,
  onSearch,
  onCreate,
  onDelete,
  onEdit,
  loading = false,
  pagination,
  searchPlaceholder = 'Pesquisar...',
  emptyMessage = 'Nenhum registro encontrado',
  gridId = 'default',
  showActions = true,
  getRowClassName,
}: DataGridProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Carregar preferências salvas
  useEffect(() => {
    const prefs = loadGridPreferences(gridId);
    const requiredColumns = columns.filter(col => col.required || col.fixed).map(col => col.key);

    if (prefs) {
      if (prefs.columnWidths) setColumnWidths(prefs.columnWidths);
      if (prefs.visibleColumns && prefs.visibleColumns.length > 0) {
        setVisibleColumns([...new Set([...requiredColumns, ...prefs.visibleColumns])]);
      } else {
        setVisibleColumns(columns.map(col => col.key));
      }
    } else {
      setVisibleColumns(columns.map(col => col.key));
    }
  }, [gridId, columns]);

  // Salvar preferências quando mudarem
  useEffect(() => {
    if (visibleColumns.length > 0) {
      saveGridPreferences(gridId, { columnWidths, visibleColumns });
    }
  }, [columnWidths, visibleColumns, gridId]);

  // Debounce da pesquisa
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setSearchTerm(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (onSearch) {
      searchTimeoutRef.current = setTimeout(() => onSearch(value), 300);
    }
  };

  useEffect(() => () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }, []);

  // Ordenação
  const handleSort = (columnKey: string): void => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Dados ordenados localmente
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  // Colunas visíveis filtradas
  const visibleColumnsData = useMemo(
    () => columns.filter(col => visibleColumns.includes(col.key)),
    [columns, visibleColumns],
  );

  // Redimensionamento de colunas
  const handleResizeStart = (e: MouseEvent<HTMLDivElement>, columnKey: string): void => {
    e.preventDefault();
    e.stopPropagation();
    const currentWidth = columnWidths[columnKey] || columns.find(col => col.key === columnKey)?.width || 150;
    setResizingColumn(columnKey);
    setResizeStartX(e.clientX);
    setResizeStartWidth(currentWidth);
  };

  useEffect(() => {
    if (!resizingColumn) return;
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const newWidth = Math.max(80, resizeStartWidth + (e.clientX - resizeStartX));
      setColumnWidths(prev => ({ ...prev, [resizingColumn]: newWidth }));
    };
    const handleMouseUp = () => setResizingColumn(null);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth]);

  // Toggle visibilidade de coluna
  const toggleColumnVisibility = (columnKey: string): void => {
    const column = columns.find(col => col.key === columnKey);
    if (column && (column.required || column.fixed)) return;
    setVisibleColumns(prev =>
      prev.includes(columnKey) ? prev.filter(k => k !== columnKey) : [...prev, columnKey],
    );
  };

  const getColumnWidth = (columnKey: string): number =>
    columnWidths[columnKey] || columns.find(col => col.key === columnKey)?.width || 150;

  // Ações rápidas
  const handleQuickDelete = (e: MouseEvent<HTMLButtonElement>, record: T): void => {
    e.stopPropagation();
    setDeleteTarget(record);
  };

  const handleQuickEdit = (e: MouseEvent<HTMLButtonElement>, record: T): void => {
    e.stopPropagation();
    onEdit?.(record);
  };

  const confirmDelete = () => {
    if (deleteTarget) onDelete?.(deleteTarget);
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card w-full max-w-full overflow-hidden">
        {/* Header com pesquisa e ações */}
        <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 sm:max-w-md">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder={searchPlaceholder}
                className="w-full h-9 pl-10 pr-4 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button onClick={() => setShowColumnModal(true)} variant="secondary" size="sm" title="Personalizar colunas">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </Button>

            {onCreate && (
              <Button onClick={onCreate} variant="primary" size="sm">
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Novo
              </Button>
            )}
          </div>
        </div>

        {/* Tabela com scroll horizontal */}
        <div className="overflow-x-auto w-full" ref={tableRef} style={{ maxWidth: '100%' }}>
          <table className="divide-y divide-slate-100 dark:divide-slate-800" style={{ width: 'max-content', minWidth: '100%' }}>
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                {visibleColumnsData.map(column => (
                  <th
                    key={column.key}
                    style={{ width: getColumnWidth(column.key) }}
                    className={`px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative select-none ${
                      column.sortable !== false ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800' : ''
                    }`}
                    onClick={() => column.sortable !== false && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-1.5">
                      {column.label}
                      {column.sortable !== false && sortColumn === column.key && (
                        <svg
                          className={`w-3.5 h-3.5 text-brand-500 ${sortDirection === 'asc' ? '' : 'rotate-180'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      )}
                    </div>
                    {/* Handle de redimensionamento */}
                    <div
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-brand-300 dark:hover:bg-brand-700"
                      onMouseDown={e => handleResizeStart(e, column.key)}
                    />
                  </th>
                ))}
                {showActions && (onDelete || onEdit) && (
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                    style={{ width: 100 }}
                  >
                    Ações
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-50 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={visibleColumnsData.length + (showActions ? 1 : 0)}
                    className="px-5 py-12 text-center"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-7 w-7 border-2 border-slate-200 dark:border-slate-700 border-t-brand-600 dark:border-t-brand-400" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">Carregando...</p>
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumnsData.length + (showActions ? 1 : 0)}
                    className="px-5 py-12 text-center"
                  >
                    <p className="text-sm text-slate-400 dark:text-slate-500">{emptyMessage}</p>
                  </td>
                </tr>
              ) : (
                sortedData.map((row, index) => {
                  const rowId = (row as { id?: string | number }).id || index;
                  const rowClassName = getRowClassName ? getRowClassName(row) : '';
                  return (
                    <tr
                      key={rowId}
                      onClick={() => onRowClick && onRowClick(row)}
                      className={`transition-colors ${
                        onRowClick ? 'cursor-pointer' : ''
                      } ${rowClassName || 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    >
                      {visibleColumnsData.map(column => (
                        <td
                          key={column.key}
                          style={{ width: getColumnWidth(column.key) }}
                          className="px-5 py-3.5 text-sm text-slate-700 dark:text-slate-300 overflow-hidden text-ellipsis"
                          title={String(row[column.key] ?? '')}
                        >
                          {column.render ? column.render(row[column.key], row) : String(row[column.key] ?? '-')}
                        </td>
                      ))}
                      {showActions && (onDelete || onEdit) && (
                        <td
                          className="px-5 py-3.5 whitespace-nowrap text-sm"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex gap-1">
                            {onEdit && (
                              <button
                                onClick={e => handleQuickEdit(e, row)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors"
                                title="Editar"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                            )}
                            {onDelete && (
                              <button
                                onClick={e => handleQuickDelete(e, row)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors"
                                title="Excluir"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {pagination && pagination.total > 0 && (
          <div className="px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Mostrando {(pagination.page - 1) * pagination.pageSize + 1}–
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} de{' '}
              {pagination.total} registros
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => pagination.onPageChange?.(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                Anterior
              </Button>
              <span className="text-xs text-slate-500 dark:text-slate-400 px-1 tabular-nums">
                {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => pagination.onPageChange?.(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de personalização de colunas */}
      <Modal
        isOpen={showColumnModal}
        onClose={() => setShowColumnModal(false)}
        title="Personalizar Colunas"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowColumnModal(false)}>
              Fechar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setVisibleColumns(columns.map(col => col.key));
                setShowColumnModal(false);
              }}
            >
              Mostrar Todas
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Selecione as colunas que deseja exibir:
        </p>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {columns.map(column => {
            const isRequired = column.required || column.fixed;
            const isChecked = visibleColumns.includes(column.key);
            return (
              <label
                key={column.key}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isRequired
                    ? 'opacity-60 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleColumnVisibility(column.key)}
                  disabled={isRequired}
                  className="w-4 h-4 rounded text-brand-600 border-slate-300 dark:border-slate-600 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {column.label}
                  {isRequired && (
                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">(obrigatória)</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirmar exclusão"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Excluir
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </>
  );
}

export default DataGrid;
