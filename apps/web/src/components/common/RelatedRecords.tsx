import { useNavigate } from 'react-router-dom';
import { DataGrid } from './DataGrid';
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
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">
          {records.length} registro(s) encontrado(s)
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <DataGrid<T>
            data={records}
            columns={columns}
            onRowClick={handleRowClick}
            loading={false}
            pagination={null}
            showActions={false}
            searchPlaceholder=""
            emptyMessage={emptyMessage}
            gridId={`related-${title.toLowerCase().replace(/\s+/g, '-')}`}
          />
        </div>
      )}
    </div>
  );
}
