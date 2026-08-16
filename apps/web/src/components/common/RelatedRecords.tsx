import { useNavigate } from 'react-router-dom';
import { DataGrid } from './DataGrid';
import LoadingSpinner from './LoadingSpinner';
import type { GridColumn } from '../../types';

export interface RelatedRecord {
  id: number | string;
  [key: string]: unknown;
}

interface RelatedRecordsProps<T = RelatedRecord> {
  title: string;
  records: T[];
  columns: GridColumn<T>[];
  basePath: string; // Caminho base para navegação (ex: '/usuarios', '/roles')
  getRecordId: (record: T) => number | string;
  emptyMessage?: string;
  loading?: boolean;
}

/**
 * Componente para exibir registros relacionados em uma grid
 * Estilo Salesforce - empilhado na aba Relacionados
 */
export default function RelatedRecords<T extends RelatedRecord = RelatedRecord>({
  title,
  records,
  columns,
  basePath,
  getRecordId,
  emptyMessage = `Nenhum ${title.toLowerCase()} encontrado.`,
  loading = false,
}: RelatedRecordsProps<T>) {
  const navigate = useNavigate();

  const handleRowClick = (record: T) => {
    const id = getRecordId(record);
    navigate(`${basePath}/${id}`);
  };

  return (
    <div className="mb-6">
      <div className="mb-3">
        <h3 className="text-base font-semibold font-display text-slate-800 dark:text-slate-200">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {records.length} registro(s) encontrado(s)
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">{emptyMessage}</p>
        </div>
      ) : (
        <DataGrid<T>
          data={records}
          columns={columns}
          onRowClick={handleRowClick}
          loading={false}
          pagination={undefined}
          showActions={false}
          searchPlaceholder=""
          emptyMessage={emptyMessage}
          gridId={`related-${title.toLowerCase().replace(/\s+/g, '-')}`}
        />
      )}
    </div>
  );
}
