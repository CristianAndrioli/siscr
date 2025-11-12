import { useState, useMemo, useRef, useEffect } from 'react';
import Button from './Button';
import Modal from './Modal';
import { saveGridPreferences, loadGridPreferences } from '../../utils/gridPreferences';

/**
 * DataGrid - Componente reutilizável para exibir dados em tabela
 * Inspirado no Salesforce, com pesquisa, ordenação, paginação, personalização de colunas e ações rápidas
 * 
 * @param {Object} props
 * @param {Array} props.data - Array de objetos para exibir
 * @param {Array} props.columns - Configuração das colunas [{key, label, render?, sortable?, defaultWidth?}]
 * @param {Function} props.onRowClick - Callback quando clica em uma linha
 * @param {Function} props.onSearch - Callback para pesquisa (recebe searchTerm)
 * @param {Function} props.onCreate - Callback para criar novo registro
 * @param {Function} props.onDelete - Callback para deletar registro (recebe record)
 * @param {Function} props.onEdit - Callback para editar registro (recebe record)
 * @param {boolean} props.loading - Estado de carregamento
 * @param {Object} props.pagination - {page, pageSize, total, onPageChange}
 * @param {string} props.searchPlaceholder - Placeholder do campo de pesquisa
 * @param {string} props.gridId - ID único do grid para salvar preferências
 * @param {boolean} props.showActions - Mostrar coluna de ações rápidas
 */
export function DataGrid({
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
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [columnWidths, setColumnWidths] = useState({});
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [resizingColumn, setResizingColumn] = useState(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const searchTimeoutRef = useRef(null);
  const tableRef = useRef(null);

  // Carregar preferências salvas
  useEffect(() => {
    const prefs = loadGridPreferences(gridId);
    // Colunas obrigatórias (fixas) - sempre devem estar visíveis
    const requiredColumns = columns.filter(col => col.required || col.fixed).map(col => col.key);
    
    if (prefs) {
      if (prefs.columnWidths) {
        setColumnWidths(prefs.columnWidths);
      }
      if (prefs.visibleColumns && prefs.visibleColumns.length > 0) {
        // Garantir que colunas obrigatórias sempre estejam visíveis
        const visible = [...new Set([...requiredColumns, ...prefs.visibleColumns])];
        setVisibleColumns(visible);
      } else {
        // Se não houver preferências, todas as colunas são visíveis
        setVisibleColumns(columns.map(col => col.key));
      }
    } else {
      // Primeira vez: todas as colunas visíveis
      setVisibleColumns(columns.map(col => col.key));
    }
  }, [gridId, columns]);

  // Salvar preferências quando mudarem
  useEffect(() => {
    if (visibleColumns.length > 0) {
      saveGridPreferences(gridId, {
        columnWidths,
        visibleColumns,
      });
    }
  }, [columnWidths, visibleColumns, gridId]);

  // Debounce da pesquisa
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (onSearch) {
      searchTimeoutRef.current = setTimeout(() => {
        onSearch(value);
      }, 300);
    }
  };

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Ordenação
  const handleSort = (columnKey) => {
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
  const visibleColumnsData = useMemo(() => {
    return columns.filter(col => visibleColumns.includes(col.key));
  }, [columns, visibleColumns]);

  // Redimensionamento de colunas
  const handleResizeStart = (e, columnKey) => {
    e.preventDefault();
    e.stopPropagation();
    const currentWidth = columnWidths[columnKey] || columns.find(col => col.key === columnKey)?.defaultWidth || 150;
    setResizingColumn(columnKey);
    setResizeStartX(e.clientX);
    setResizeStartWidth(currentWidth);
  };

  useEffect(() => {
    if (!resizingColumn) return;

    const handleResizeMove = (e) => {
      const diff = e.clientX - resizeStartX;
      const newWidth = Math.max(80, resizeStartWidth + diff);
      
      setColumnWidths(prev => ({
        ...prev,
        [resizingColumn]: newWidth,
      }));
    };

    const handleResizeEnd = () => {
      setResizingColumn(null);
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [resizingColumn, resizeStartX, resizeStartWidth, columns]);

  // Toggle visibilidade de coluna (não permite desmarcar colunas obrigatórias)
  const toggleColumnVisibility = (columnKey) => {
    const column = columns.find(col => col.key === columnKey);
    // Não permite desmarcar colunas obrigatórias
    if (column && (column.required || column.fixed)) {
      return;
    }
    
    setVisibleColumns(prev => {
      if (prev.includes(columnKey)) {
        return prev.filter(key => key !== columnKey);
      } else {
        return [...prev, columnKey];
      }
    });
  };

  // Obter largura da coluna
  const getColumnWidth = (columnKey) => {
    return columnWidths[columnKey] || columns.find(col => col.key === columnKey)?.defaultWidth || 150;
  };

  // Ações rápidas
  const handleQuickDelete = (e, record) => {
    e.stopPropagation();
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      onDelete?.(record);
    }
  };

  const handleQuickEdit = (e, record) => {
    e.stopPropagation();
    onEdit?.(record);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header com pesquisa e ações */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => setShowColumnModal(true)}
            variant="secondary"
            size="sm"
            title="Personalizar colunas"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </Button>
          
          {onCreate && (
            <Button onClick={onCreate} variant="primary" size="sm">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto" ref={tableRef}>
        <table className="min-w-full divide-y divide-gray-200" style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead className="bg-gray-50">
            <tr>
              {visibleColumnsData.map((column) => (
                <th
                  key={column.key}
                  style={{ width: getColumnWidth(column.key) }}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider relative ${
                    column.sortable !== false ? 'cursor-pointer hover:bg-gray-100' : ''
                  }`}
                  onClick={() => column.sortable !== false && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable !== false && sortColumn === column.key && (
                      <svg
                        className={`w-4 h-4 ${sortDirection === 'asc' ? '' : 'transform rotate-180'}`}
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
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-indigo-300"
                    onMouseDown={(e) => handleResizeStart(e, column.key)}
                  />
                </th>
              ))}
              {showActions && (onDelete || onEdit) && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: 120 }}>
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={visibleColumnsData.length + (showActions ? 1 : 0)} className="px-6 py-12 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">Carregando...</p>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnsData.length + (showActions ? 1 : 0)} className="px-6 py-12 text-center">
                  <p className="text-sm text-gray-500">{emptyMessage}</p>
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <tr
                  key={row.id || index}
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`hover:bg-indigo-50 transition-colors ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {visibleColumnsData.map((column) => (
                    <td
                      key={column.key}
                      style={{ width: getColumnWidth(column.key) }}
                      className="px-6 py-4 text-sm text-gray-900 overflow-hidden text-ellipsis"
                      title={row[column.key]}
                    >
                      {column.render
                        ? column.render(row[column.key], row)
                        : row[column.key] ?? '-'}
                    </td>
                  ))}
                  {showActions && (onDelete || onEdit) && (
                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex gap-2">
                        {onEdit && (
                          <button
                            onClick={(e) => handleQuickEdit(e, row)}
                            className="text-indigo-600 hover:text-indigo-900 p-1 rounded"
                            title="Editar"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={(e) => handleQuickDelete(e, row)}
                            className="text-red-600 hover:text-red-900 p-1 rounded"
                            title="Excluir"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      {pagination && pagination.total > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Mostrando {((pagination.page - 1) * pagination.pageSize) + 1} a{' '}
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} de{' '}
            {pagination.total} registros
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
            >
              Anterior
            </Button>
            <span className="px-4 py-2 text-sm text-gray-700">
              Página {pagination.page} de {Math.ceil(pagination.total / pagination.pageSize)}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      {/* Modal de personalização de colunas */}
      <Modal
        isOpen={showColumnModal}
        onClose={() => setShowColumnModal(false)}
        title="Personalizar Colunas"
        size="md"
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
        <div className="space-y-3">
          <p className="text-sm text-gray-600 mb-4">
            Selecione as colunas que deseja exibir no grid:
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {columns.map((column) => {
              const isRequired = column.required || column.fixed;
              const isChecked = visibleColumns.includes(column.key);
              
              return (
                <label
                  key={column.key}
                  className={`flex items-center space-x-3 p-2 rounded ${
                    isRequired 
                      ? 'bg-gray-50 cursor-not-allowed opacity-75' 
                      : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleColumnVisibility(column.key)}
                    disabled={isRequired}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <span className={`text-sm ${isRequired ? 'text-gray-500 font-medium' : 'text-gray-700'}`}>
                    {column.label}
                    {isRequired && (
                      <span className="ml-2 text-xs text-gray-400">(obrigatória)</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DataGrid;
