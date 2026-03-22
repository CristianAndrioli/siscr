import { useMemo } from 'react';
import type { GridColumn } from '../types';

type FieldType = 'boolean' | 'number' | 'string' | 'date' | 'time' | 'decimal' | 'array' | 'object' | 'unknown';

interface AutoColumnsConfig {
  hiddenFields?: string[];
  fieldOverrides?: Record<string, Partial<GridColumn>>;
  requiredFields?: string[];
  defaultWidths?: Record<string, number>;
}

/**
 * Hook para gerar colunas do grid automaticamente baseado em dados da API
 * Identifica automaticamente a chave primária e marca como obrigatória
 */
export function useAutoColumns(
  sampleData: unknown[] = [],
  config: AutoColumnsConfig = {}
): GridColumn[] {
  const {
    hiddenFields = [],
    fieldOverrides = {},
    requiredFields = [],
    defaultWidths = {},
  } = config;

  const columns = useMemo(() => {
    if (!sampleData || sampleData.length === 0) {
      return [];
    }

    // Pegar o primeiro registro como amostra
    const sample = sampleData[0] as Record<string, unknown>;
    const fields = Object.keys(sample);

    // Identificar chave primária (campos que começam com "codigo_" ou são "id"/"pk")
    const primaryKeyFields = fields.filter(field => 
      field.startsWith('codigo_') || 
      field === 'id' || 
      field === 'pk' ||
      field.includes('_id')
    );

    // Todos os campos obrigatórios (chave primária + campos adicionais)
    const allRequiredFields = [...primaryKeyFields, ...requiredFields];

    return fields
      .filter(field => !hiddenFields.includes(field))
      .map(field => {
        const isPrimaryKey = primaryKeyFields.includes(field);
        const isRequired = allRequiredFields.includes(field);
        const value = sample[field];
        
        // Detectar tipo do campo baseado no valor
        const fieldType = detectFieldType(value);
        
        // Gerar label do campo (capitalizar e substituir underscores)
        const defaultLabel = formatFieldLabel(field);
        
        // Largura padrão baseada no tipo
        const defaultWidth = defaultWidths[field] || getDefaultWidth(fieldType, field);
        
        // Configuração base da coluna
        const column: GridColumn = {
          key: field,
          label: defaultLabel,
          width: defaultWidth,
          required: isRequired,
        };

        // Aplicar overrides customizados
        if (fieldOverrides[field]) {
          Object.assign(column, fieldOverrides[field]);
        }

        // Render customizado baseado no tipo (se não houver override)
        if (!column.render && !fieldOverrides[field]?.render) {
          column.render = getDefaultRenderer(fieldType, field);
        }

        return column;
      });
  }, [sampleData, hiddenFields, fieldOverrides, requiredFields, defaultWidths]);

  return columns;
}

/**
 * Detecta o tipo do campo baseado no valor
 */
function detectFieldType(value: unknown): FieldType {
  if (value === null || value === undefined) {
    return 'unknown';
  }
  
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  
  if (typeof value === 'number') {
    return 'number';
  }
  
  if (typeof value === 'string') {
    // Detectar formatos especiais
    if (/^\d{2}\/\d{2}\/\d{4}/.test(value)) {
      return 'date';
    }
    if (/^\d{2}:\d{2}/.test(value)) {
      return 'time';
    }
    if (/^[\d.-]+$/.test(value) && value.length > 10) {
      return 'decimal';
    }
    return 'string';
  }
  
  if (Array.isArray(value)) {
    return 'array';
  }
  
  if (typeof value === 'object') {
    return 'object';
  }
  
  return 'unknown';
}

/**
 * Formata o nome do campo para label legível
 */
function formatFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Retorna largura padrão baseada no tipo e nome do campo
 */
function getDefaultWidth(type: FieldType, fieldName: string): number {
  // Campos de código são menores
  if (fieldName.includes('codigo') || fieldName === 'id') {
    return 100;
  }
  
  // Campos booleanos são pequenos
  if (type === 'boolean') {
    return 80;
  }
  
  // Campos numéricos são médios
  if (type === 'number' || type === 'decimal') {
    return 120;
  }
  
  // Campos de data/hora são médios
  if (type === 'date' || type === 'time') {
    return 120;
  }
  
  // Campos de texto são maiores
  if (type === 'string') {
    // Campos específicos com tamanhos conhecidos
    if (fieldName.includes('nome') || fieldName.includes('razao')) {
      return 250;
    }
    if (fieldName.includes('email')) {
      return 200;
    }
    if (fieldName.includes('cidade')) {
      return 150;
    }
    if (fieldName.includes('estado') || fieldName.includes('uf')) {
      return 80;
    }
    return 150;
  }
  
  return 150; // Padrão
}

/**
 * Retorna função de render padrão baseada no tipo
 */
function getDefaultRenderer(type: FieldType, fieldName: string): ((value: unknown) => React.ReactNode) | undefined {
  if (type === 'boolean') {
    return (value) => (value ? 'Sim' : 'Não');
  }
  
  if (type === 'date') {
    return (value) => {
      if (!value) return '-';
      try {
        const date = new Date(value as string);
        return date.toLocaleDateString('pt-BR');
      } catch {
        return String(value);
      }
    };
  }
  
  if (type === 'decimal' || (type === 'number' && fieldName.includes('valor'))) {
    return (value) => {
      if (value === null || value === undefined) return '-';
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(value));
    };
  }
  
  // Para campos que podem ser null/undefined
  return (value) => value ?? '-';
}

export default useAutoColumns;

