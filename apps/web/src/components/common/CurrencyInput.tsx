import React from 'react';

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

  const baseClass =
    'w-full h-9 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-sm bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors text-left tabular-nums caret-transparent';

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      value={displayValue}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      onKeyDown={handleKeyDown}
      onChange={() => {}}
      className={className || baseClass}
    />
  );
}
