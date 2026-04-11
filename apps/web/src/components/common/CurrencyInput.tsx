import { useRef } from 'react';

interface CurrencyInputProps {
  value: number | null | undefined;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  className?: string;
  id?: string;
  name?: string;
}

/**
 * Input monetário BRL com máscara "digitar-da-direita".
 * O usuário digita somente dígitos; o componente formata automaticamente.
 * Ex: digitar "1234" exibe "12,34" e entrega o número 12.34 ao onChange.
 */
export default function CurrencyInput({
  value,
  onChange,
  placeholder = '0,00',
  disabled = false,
  required = false,
  min,
  className = '',
  id,
  name,
}: CurrencyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const format = (cents: number): string => {
    return (cents / 100).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const displayValue = (value != null && !isNaN(value)) ? format(Math.round(value * 100)) : '';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab' || e.key === 'Enter') return;

    e.preventDefault();

    const currentCents = Math.round((value ?? 0) * 100);

    if (e.key === 'Backspace' || e.key === 'Delete') {
      const newCents = Math.floor(currentCents / 10);
      onChange(newCents / 100);
      return;
    }

    if (!/^\d$/.test(e.key)) return;

    const digit = parseInt(e.key, 10);
    const newCents = currentCents * 10 + digit;

    if (min !== undefined && newCents / 100 < min && newCents !== 0) return;

    onChange(newCents / 100);
  };

  const handleFocus = () => {
    setTimeout(() => {
      const el = inputRef.current;
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    }, 0);
  };

  const baseClass =
    'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-right tabular-nums';

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      value={displayValue}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onChange={() => {}}
      className={className || baseClass}
    />
  );
}
