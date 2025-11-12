import { useMemo } from 'react';

/**
 * Hook para gerar campos de formulário automaticamente baseado em dados
 * Similar ao useAutoColumns, mas para formulários
 * 
 * @param {Object} sampleData - Amostra de dados (um registro)
 * @param {Object} config - Configuração
 * @param {Array} config.hiddenFields - Campos que não devem aparecer
 * @param {Object} config.fieldConfigs - Configuração por campo {fieldName: {type, options, ...}}
 * @param {Array} config.readOnlyFields - Campos somente leitura
 * @returns {Array} - Array de configurações de campos
 */
export function useAutoFormFields(sampleData = {}, config = {}) {
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
        const fieldConfig = {
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
function detectFieldType(value, fieldName) {
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
function isPrimaryKey(fieldName) {
  return fieldName.startsWith('codigo_') || 
         fieldName === 'id' || 
         fieldName === 'pk' ||
         fieldName.includes('_id');
}

/**
 * Formata nome do campo para label
 */
function formatFieldLabel(fieldName) {
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
function getDefaultValue(value, type) {
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
function getDefaultOptions(fieldName) {
  if (fieldName === 'tipo') {
    return [
      { value: 'PF', label: 'Pessoa Física' },
      { value: 'PJ', label: 'Pessoa Jurídica' },
    ];
  }
  
  if (fieldName === 'estado') {
    // Estados brasileiros - pode importar de constants
    return [
      { value: 'AC', label: 'Acre' },
      { value: 'AL', label: 'Alagoas' },
      { value: 'AP', label: 'Amapá' },
      { value: 'AM', label: 'Amazonas' },
      { value: 'BA', label: 'Bahia' },
      { value: 'CE', label: 'Ceará' },
      { value: 'DF', label: 'Distrito Federal' },
      { value: 'ES', label: 'Espírito Santo' },
      { value: 'GO', label: 'Goiás' },
      { value: 'MA', label: 'Maranhão' },
      { value: 'MT', label: 'Mato Grosso' },
      { value: 'MS', label: 'Mato Grosso do Sul' },
      { value: 'MG', label: 'Minas Gerais' },
      { value: 'PA', label: 'Pará' },
      { value: 'PB', label: 'Paraíba' },
      { value: 'PR', label: 'Paraná' },
      { value: 'PE', label: 'Pernambuco' },
      { value: 'PI', label: 'Piauí' },
      { value: 'RJ', label: 'Rio de Janeiro' },
      { value: 'RN', label: 'Rio Grande do Norte' },
      { value: 'RS', label: 'Rio Grande do Sul' },
      { value: 'RO', label: 'Rondônia' },
      { value: 'RR', label: 'Roraima' },
      { value: 'SC', label: 'Santa Catarina' },
      { value: 'SP', label: 'São Paulo' },
      { value: 'SE', label: 'Sergipe' },
      { value: 'TO', label: 'Tocantins' },
    ];
  }
  
  return [];
}

export default useAutoFormFields;

