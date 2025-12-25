import { ChangeEvent, InputHTMLAttributes } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  label?: string;
  name?: string;
  checked?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
  error?: string;
}

/**
 * Componente Checkbox reutilizável
 */
export default function Checkbox({
  label,
  name,
  checked = false,
  onChange,
  required = false,
  className = '',
  error = '',
  ...props
}: CheckboxProps) {
  return (
    <div className={className}>
      <div className="flex items-center">
        <input
          type="checkbox"
          id={name}
          name={name}
          checked={checked}
          onChange={onChange}
          required={required}
          className={`
            h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded
            ${error ? 'border-red-500' : ''}
          `}
          {...props}
        />
        {label && (
          <label htmlFor={name} className="ml-2 block text-sm text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}

