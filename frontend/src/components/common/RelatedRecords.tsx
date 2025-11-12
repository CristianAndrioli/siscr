import type { GridColumn } from '../../types';

interface RelatedRecordsProps {
  title: string;
  records?: unknown[];
  columns?: GridColumn[];
  onRecordClick?: (record: unknown) => void;
  emptyMessage?: string;
}

/**
 * RelatedRecords - Componente para exibir registros relacionados
 * Usado na aba "Related" do DetailView
 */
export function RelatedRecords({
  title,
  records = [],
  columns = [],
  onRecordClick,
  emptyMessage = 'Nenhum registro relacionado encontrado',
}: RelatedRecordsProps) {
  const handleRecordClick = (record: unknown): void => {
    if (onRecordClick) {
      onRecordClick(record);
    }
  };

  if (records.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-sm text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500 mt-1">{records.length} registro(s) encontrado(s)</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.map((record, index) => {
              const recordObj = record as Record<string, unknown>;
              return (
                <tr
                  key={(recordObj.id as string | number) || index}
                  onClick={() => handleRecordClick(record)}
                  className={`hover:bg-indigo-50 transition-colors ${
                    onRecordClick ? 'cursor-pointer' : ''
                  }`}
                >
                  {columns.map((column) => (
                    <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {column.render
                        ? column.render(recordObj[column.key], record)
                        : String(recordObj[column.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RelatedRecords;

