import { useState, useEffect, useRef } from 'react';
import Input from './Input';
import Select from './Select';
import Textarea from './Textarea';
import Button from './Button';
import { formatCPFCNPJ, formatCEP, formatPhone } from '../../utils/formatters';

/**
 * Componente de formulário dinâmico que gera campos automaticamente
 * 
 * @param {Array} fields - Configuração dos campos [{name, label, type, ...}]
 * @param {Object} initialData - Dados iniciais do formulário
 * @param {Function} onSubmit - Callback ao submeter (recebe formData)
 * @param {Function} onSaveAndNew - Callback para salvar e criar novo (recebe formData)
 * @param {Function} onCancel - Callback ao cancelar
 * @param {boolean} loading - Estado de carregamento
 * @param {Object} errors - Erros de validação {fieldName: 'mensagem'}
 * @param {boolean} showSaveAndNew - Mostrar botão "Salvar e Novo"
 */
function DynamicForm({
  fields = [],
  initialData = {},
  onSubmit,
  onSaveAndNew,
  onCancel,
  loading = false,
  errors = {},
  showSaveAndNew = false,
}) {
  const prevInitialDataRef = useRef({});
  const resetKeyRef = useRef(0);
  
  const [formData, setFormData] = useState(() => {
    // Inicializar com valores de initialData se disponível
    const initial = {};
    if (fields.length > 0 && Object.keys(initialData).length > 0) {
      fields.forEach(field => {
        initial[field.name] = initialData[field.name] ?? field.defaultValue ?? '';
      });
      prevInitialDataRef.current = { ...initialData };
    }
    return initial;
  });

  // Atualizar quando initialData mudar significativamente
  useEffect(() => {
    if (fields.length > 0) {
      const initialDataStr = JSON.stringify(initialData);
      const prevDataStr = JSON.stringify(prevInitialDataRef.current);
      
      // Se initialData for null/vazio (reset), limpar formulário completamente
      if (Object.keys(initialData).length === 0) {
        const empty = {};
        fields.forEach(field => {
          empty[field.name] = field.defaultValue ?? '';
        });
        setFormData(empty);
        prevInitialDataRef.current = {};
        resetKeyRef.current += 1;
      }
      // Atualizar se initialData mudou (novos dados após erro ou novo formulário)
      else if (Object.keys(initialData).length > 0 && initialDataStr !== prevDataStr) {
        setFormData(prev => {
          const updated = { ...prev };
          fields.forEach(field => {
            // Se initialData tem valor para este campo, usar ele
            if (initialData[field.name] !== undefined && initialData[field.name] !== null && initialData[field.name] !== '') {
              updated[field.name] = initialData[field.name];
            } else if (updated[field.name] === undefined) {
              // Só usar defaultValue se campo ainda não foi preenchido
              updated[field.name] = field.defaultValue ?? '';
            }
            // Caso contrário, manter valor atual (não sobrescrever dados do usuário)
          });
          return updated;
        });
        prevInitialDataRef.current = { ...initialData };
      }
    }
  }, [fields, initialData]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let newValue = type === 'checkbox' ? checked : value;
    
    // Aplicar formatação automática
    if (name.includes('cpf') || name.includes('cnpj')) {
      newValue = formatCPFCNPJ(newValue);
    } else if (name.includes('cep')) {
      newValue = formatCEP(newValue);
    } else if (name.includes('telefone') || name.includes('celular') || name.includes('fixo')) {
      newValue = formatPhone(newValue);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  const renderField = (field) => {
    const commonProps = {
      name: field.name,
      label: field.label,
      value: formData[field.name] ?? '',
      onChange: handleChange,
      required: field.required,
      readOnly: field.readOnly,
      error: errors[field.name],
      className: field.className || '',
    };

    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            rows={field.rows || 3}
            placeholder={field.placeholder}
          />
        );
      
      case 'select':
        return (
          <Select
            {...commonProps}
            options={field.options || []}
            placeholder={field.placeholder}
          />
        );
      
      case 'checkbox':
        return (
          <div className={field.className || ''}>
            <label className="flex items-center">
              <input
                type="checkbox"
                name={field.name}
                checked={formData[field.name] || false}
                onChange={handleChange}
                className="mr-2"
              />
              <span className="text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </span>
            </label>
            {errors[field.name] && (
              <p className="mt-1 text-sm text-red-600">{errors[field.name]}</p>
            )}
          </div>
        );
      
      default:
        return (
          <Input
            {...commonProps}
            type={field.type || 'text'}
            placeholder={field.placeholder}
          />
        );
    }
  };

  // Agrupar campos em seções (opcional)
  const groupedFields = fields.reduce((acc, field) => {
    const section = field.section || 'Geral';
    if (!acc[section]) {
      acc[section] = [];
    }
    acc[section].push(field);
    return acc;
  }, {});

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {Object.entries(groupedFields).map(([section, sectionFields]) => (
        <div key={section} className="space-y-4">
          {Object.keys(groupedFields).length > 1 && (
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">
              {section}
            </h3>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sectionFields.map(field => (
              <div key={field.name} className={field.fullWidth ? 'col-span-full' : ''}>
                {renderField(field)}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Botões de ação */}
      <div className="flex justify-end gap-4 pt-4 border-t">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </Button>
        )}
        {showSaveAndNew && onSaveAndNew && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => onSaveAndNew(formData)}
            disabled={loading}
          >
            Salvar e Novo
          </Button>
        )}
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={loading}
        >
          Salvar
        </Button>
      </div>
    </form>
  );
}

export default DynamicForm;

