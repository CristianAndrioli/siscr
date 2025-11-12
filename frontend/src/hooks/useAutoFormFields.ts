import { useMemo } from 'react';
import type { FormField } from '../types';
import { ESTADOS } from '../utils/constants';

type FieldType = 'text' | 'number' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' | 'date';

interface FieldConfigs {
  [fieldName: string]: Partial<FormField>;
}

interface UseAutoFormFieldsConfig {
  hiddenFields?: string[];
  fieldConfigs?: FieldConfigs;
  readOnlyFields?: string[];
}

/**
 * Hook para gerar campos de formulário automaticamente baseado em dados
 * Similar ao useAutoColumns, mas para formulários
 */
export function useAutoFormFields(
  sampleData: Record<string, unknown> = {},
  config: UseAutoFormFieldsConfig = {}
): FormField[] {
  const {
    hiddenFields = [],
    fieldConfigs = {},
    readOnlyFields = [],
  } = config;

  const fields = useMemo(() => {
    if (!sampleData || Object.keys(sampleData).length === 0) {
      return [];
    }

    const fieldKeys = Object.keys(sampleData);

    return fieldKeys
      .filter(field => !hiddenFields.includes(field))
      .map(field => {
        const value = sampleData[field];
        const fieldType = detectFieldType(value, field);
        const isReadOnly = readOnlyFields.includes(field) || isPrimaryKey(field);
        
        // Configuração base do campo
        const fieldConfig: FormField = {
          name: field,
          label: formatFieldLabel(field),
          type: fieldType,
          required: isPrimaryKey(field),
          readOnly: isReadOnly,
          defaultValue: getDefaultValue(value, fieldType),
        };

        // Aplicar configurações customizadas
        if (fieldConfigs[field]) {
          Object.assign(fieldConfig, fieldConfigs[field]);
        }

        // Adicionar opções para selects
        if (fieldType === 'select' && !fieldConfig.options) {
          fieldConfig.options = getDefaultOptions(field);
        }

        return fieldConfig;
      });
  }, [sampleData, hiddenFields, fieldConfigs, readOnlyFields]);

  return fields;
}

/**
 * Detecta o tipo do campo baseado no valor e nome
 */
function detectFieldType(value: unknown, fieldName: string): FieldType {
  // Verificar se há configuração customizada primeiro
  if (fieldName.includes('email')) return 'email';
  if (fieldName.includes('telefone') || fieldName.includes('celular') || fieldName.includes('fixo')) return 'tel';
  if (fieldName.includes('cep')) return 'text'; // Será formatado
  if (fieldName.includes('cpf') || fieldName.includes('cnpj')) return 'text'; // Será formatado
  if (fieldName.includes('data') || fieldName.includes('date')) return 'date';
  if (fieldName.includes('valor') || fieldName.includes('preco') || fieldName.includes('custo')) return 'number';
  if (fieldName.includes('observacao') || fieldName.includes('descricao') || fieldName.includes('observacoes')) return 'textarea';
  if (fieldName.includes('tipo') || fieldName.includes('status') || fieldName.includes('estado')) {
    // Pode ser select se tiver opções conhecidas
    return 'select';
  }
  
  if (value === null || value === undefined) {
    return 'text';
  }
  
  if (typeof value === 'boolean') {
    return 'checkbox';
  }
  
  if (typeof value === 'number') {
    return 'number';
  }
  
  if (typeof value === 'string') {
    if (value.length > 100) {
      return 'textarea';
    }
    return 'text';
  }
  
  return 'text';
}

/**
 * Verifica se é chave primária
 */
function isPrimaryKey(fieldName: string): boolean {
  return fieldName.startsWith('codigo_') || 
         fieldName === 'id' || 
         fieldName === 'pk' ||
         fieldName.includes('_id');
}

/**
 * Formata nome do campo para label
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
 * Retorna valor padrão baseado no tipo
 */
function getDefaultValue(value: unknown, type: FieldType): unknown {
  if (value !== null && value !== undefined) {
    return value;
  }
  
  switch (type) {
    case 'number':
      return 0;
    case 'checkbox':
      return false;
    case 'select':
      return '';
    default:
      return '';
  }
}

/**
 * Retorna opções padrão para campos select conhecidos
 */
function getDefaultOptions(fieldName: string): Array<{ value: string | number; label: string }> {
  if (fieldName === 'tipo') {
    return [
      { value: 'PF', label: 'Pessoa Física' },
      { value: 'PJ', label: 'Pessoa Jurídica' },
    ];
  }
  
  if (fieldName === 'estado') {
    // Estados brasileiros - importado de constants
    return ESTADOS.map(estado => ({
      value: estado.value,
      label: estado.label,
    }));
  }
  
  return [];
}

export default useAutoFormFields;

