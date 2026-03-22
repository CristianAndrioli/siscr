import { useMemo } from 'react';
import { useAutoColumns } from './useAutoColumns';
import type { GridColumn } from '../types';

interface AutoConfig {
  hiddenFields?: string[];
  fieldOverrides?: Record<string, Partial<GridColumn>>;
  requiredFields?: string[];
  defaultWidths?: Record<string, number>;
}

interface UseGridColumnsConfig {
  manualColumns?: GridColumn[];
  autoConfig?: AutoConfig;
}

/**
 * Hook completo para gerenciar colunas do grid com geração automática
 * Combina geração automática com configuração manual
 */
export function useGridColumns(
  data: unknown[] = [],
  config: UseGridColumnsConfig = {}
): GridColumn[] {
  const { manualColumns, autoConfig = {} } = config;
  
  // Gerar colunas automaticamente (sempre chamado, mas pode retornar vazio se não houver dados)
  const autoColumns = useAutoColumns(data, autoConfig);
  
  // Se colunas manuais foram fornecidas, usar elas, senão usar as automáticas
  const columns = useMemo(() => {
    if (manualColumns && manualColumns.length > 0) {
      return manualColumns;
    }
    return autoColumns;
  }, [manualColumns, autoColumns]);
  
  return columns;
}

export default useGridColumns;

