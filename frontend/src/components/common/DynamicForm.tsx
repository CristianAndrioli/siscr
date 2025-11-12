import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import Input from './Input';
import Select from './Select';
import Textarea from './Textarea';
import Button from './Button';
import { formatCPFCNPJ, formatCEP, formatPhone } from '../../utils/formatters';
import type { FormField } from '../../types';

interface DynamicFormProps {
  fields?: FormField[];
  initialData?: Record<string, unknown>;
  onSubmit?: (formData: Record<string, unknown>) => void;
  onSaveAndNew?: (formData: Record<string, unknown>) => void;
  onCancel?: () => void;
  loading?: boolean;
  errors?: Record<string, string>;
  showSaveAndNew?: boolean;
}

/**
 * Componente de formulário dinâmico que gera campos automaticamente
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
}: DynamicFormProps) {
  const prevInitialDataRef = useRef<Record<string, unknown>>({});
  const resetKeyRef = useRef(0);
  
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    // Inicializar com valores de initialData se disponível
    const initial: Record<string, unknown> = {};
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
        const empty: Record<string, unknown> = {};
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

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    let newValue: unknown = type === 'checkbox' ? checked : value;
    
    // Aplicar formatação automática
    if (name.includes('cpf') || name.includes('cnpj')) {
      newValue = formatCPFCNPJ(String(newValue));
    } else if (name.includes('cep')) {
      newValue = formatCEP(String(newValue));
    } else if (name.includes('telefone') || name.includes('celular') || name.includes('fixo')) {
      newValue = formatPhone(String(newValue));
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue,
    }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(formData);
    }
  };

  const renderField = (field: FormField): React.ReactNode => {
    const value = formData[field.name] ?? field.defaultValue ?? '';
    const error = errors[field.name];

    switch (field.type) {
      case 'select':
        return (
          <Select
            key={field.name}
            label={field.label}
            name={field.name}
            value={String(value)}
            onChange={handleChange}
            options={field.options || []}
            required={field.required}
            error={error}
            readOnly={field.readOnly}
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            key={field.name}
            label={field.label}
            name={field.name}
            value={String(value)}
            onChange={handleChange}
            rows={field.rows || 3}
            required={field.required}
            error={error}
            readOnly={field.readOnly}
          />
        );
      
      case 'checkbox':
        return (
          <div key={field.name} className="flex items-center">
            <input
              type="checkbox"
              id={field.name}
              name={field.name}
              checked={Boolean(value)}
              onChange={handleChange}
              disabled={field.readOnly}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            {field.label && (
              <label htmlFor={field.name} className="ml-2 block text-sm font-medium text-gray-700">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
            )}
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>
        );
      
      default:
        return (
          <Input
            key={field.name}
            label={field.label}
            type={field.type || 'text'}
            name={field.name}
            value={String(value)}
            onChange={handleChange}
            required={field.required}
            readOnly={field.readOnly}
            error={error}
            step={field.step}
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
  }, {} as Record<string, FormField[]>);

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

