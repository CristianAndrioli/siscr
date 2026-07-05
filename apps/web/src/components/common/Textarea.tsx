import { ChangeEvent, TextareaHTMLAttributes } from 'react';

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  label?: string;
  name?: string;
  value?: string | number;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  placeholder?: string;
  required?: boolean;
  className?: string;
  error?: string;
}

/**
 * Componente Textarea reutilizável
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
}: TextareaProps) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={name} className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
          block w-full px-3 py-2 rounded-lg border text-sm
          bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100
          placeholder-slate-400 dark:placeholder-slate-500
          transition-colors duration-150
          focus:outline-none focus:ring-2
          ${error
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-slate-300 dark:border-slate-700 focus:border-brand-500 focus:ring-brand-500/20'}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
