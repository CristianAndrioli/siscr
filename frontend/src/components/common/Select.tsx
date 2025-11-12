import { ChangeEvent, SelectHTMLAttributes } from 'react';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  name?: string;
  value?: string | number;
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void;
  options?: SelectOption[];
  required?: boolean;
  className?: string;
  error?: string;
}

/**
 * Componente Select reutilizável
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
}: SelectProps) {
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

