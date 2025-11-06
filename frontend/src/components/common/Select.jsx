/**
 * Componente Select reutilizável
 * @param {string} label - Label do campo
 * @param {string} name - Nome do campo
 * @param {string} value - Valor selecionado
 * @param {function} onChange - Função de onChange
 * @param {array} options - Array de opções [{value: '', label: ''}]
 * @param {boolean} required - Campo obrigatório
 * @param {string} className - Classes CSS adicionais
 * @param {string} error - Mensagem de erro
 * @param {object} props - Outras props do select
 */
export default function Select({
  label,
  name,
  value,
  onChange,
  options = [],
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
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        className={`
          mt-1 block w-full rounded-md border-gray-300 shadow-sm 
          focus:border-indigo-500 focus:ring-indigo-500 p-2 bg-white
          ${error ? 'border-red-500' : ''}
        `}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

