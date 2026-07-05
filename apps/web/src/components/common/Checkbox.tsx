import { ChangeEvent, InputHTMLAttributes } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  label?: string;
  name?: string;
  checked?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
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
  helpText,
  ...props
}: CheckboxProps) {
  return (
    <div className={className}>
      <label htmlFor={name} className="inline-flex items-center gap-2 min-h-[36px] cursor-pointer select-none">
        <input
          type="checkbox"
          id={name}
          name={name}
          checked={checked}
          onChange={onChange}
          required={required}
          className={`
            h-4 w-4 rounded border-slate-300 dark:border-slate-600
            text-brand-600 bg-white dark:bg-slate-900
            focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0
            ${error ? 'border-red-500' : ''}
          `}
          {...props}
        />
        {label && (
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </span>
        )}
      </label>
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helpText}</p>
      )}
    </div>
  );
}
