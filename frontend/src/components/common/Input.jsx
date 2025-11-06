/**
 * Componente Input reutilizável
 * @param {string} label - Label do campo
 * @param {string} type - Tipo do input (text, email, number, etc.)
 * @param {string} name - Nome do campo (para formData)
 * @param {string} value - Valor do campo
 * @param {function} onChange - Função de onChange
 * @param {string} placeholder - Placeholder
 * @param {boolean} required - Campo obrigatório
 * @param {boolean} readOnly - Campo somente leitura
 * @param {string} className - Classes CSS adicionais
 * @param {string} error - Mensagem de erro
 * @param {object} props - Outras props do input
 */
export default function Input({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  required = false,
  readOnly = false,
  className = '',
  error = '',
  ...props
}) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        readOnly={readOnly}
        className={`
          mt-1 block w-full rounded-md border-gray-300 shadow-sm 
          focus:border-indigo-500 focus:ring-indigo-500 p-2
          ${readOnly ? 'bg-gray-100' : 'bg-white'}
          ${error ? 'border-red-500' : ''}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

