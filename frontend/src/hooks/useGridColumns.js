import { useMemo } from 'react';
import { useAutoColumns } from './useAutoColumns';

/**
 * Hook completo para gerenciar colunas do grid com geração automática
 * Combina geração automática com configuração manual
 * 
 * @param {Array} data - Dados do grid (usado para detectar campos)
 * @param {Object} config - Configuração
 * @param {Array} config.manualColumns - Colunas definidas manualmente (override completo)
 * @param {Object} config.autoConfig - Configuração para geração automática
 * @returns {Array} - Colunas finais do grid
 */
export function useGridColumns(data = [], config = {}) {
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

