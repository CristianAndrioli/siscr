import { ChangeEvent, InputHTMLAttributes } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  type?: string;
  name?: string;
  value?: string | number;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  className?: string;
  error?: string;
  helpText?: string;
}

/**
 * Componente Input reutilizável
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
  helpText,
  ...props
}: InputProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={name} className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
          block w-full h-9 px-3 rounded-lg border text-sm
          text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500
          transition-colors duration-150
          focus:outline-none focus:ring-2
          ${readOnly
            ? 'bg-slate-50 dark:bg-slate-800/60 cursor-default'
            : 'bg-white dark:bg-slate-900'}
          ${error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-slate-300 dark:border-slate-700 focus:border-brand-500 focus:ring-brand-500/20'}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
      {helpText && !error && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helpText}</p>
      )}
    </div>
  );
}
