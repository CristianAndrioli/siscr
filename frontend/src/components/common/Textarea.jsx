/**
 * Componente Textarea reutilizável
 * @param {string} label - Label do campo
 * @param {string} name - Nome do campo
 * @param {string} value - Valor do campo
 * @param {function} onChange - Função de onChange
 * @param {number} rows - Número de linhas
 * @param {string} placeholder - Placeholder
 * @param {boolean} required - Campo obrigatório
 * @param {string} className - Classes CSS adicionais
 * @param {string} error - Mensagem de erro
 * @param {object} props - Outras props do textarea
 */
export default function Textarea({
  label,
  name,
  value,
  onChange,
  rows = 3,
  placeholder,
  required = false,
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
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        required={required}
        className={`
          mt-1 block w-full rounded-md border-gray-300 shadow-sm 
          focus:border-indigo-500 focus:ring-indigo-500 p-2 bg-white
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

