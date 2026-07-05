import { forwardRef } from 'react';
import {
  formatCPFCNPJ,
  formatCPF,
  formatCNPJ,
  formatPhone,
  formatCEP,
} from '../../utils/formatters';

type MaskType = 'cpf' | 'cnpj' | 'cpf_cnpj' | 'phone' | 'cep';

interface MaskedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  mask: MaskType;
  value: string;
  onChange: (value: string) => void;
}

const MAX_DIGITS: Record<MaskType, number> = {
  cpf: 11,
  cnpj: 14,
  cpf_cnpj: 14,
  phone: 11,
  cep: 8,
};

function applyMask(mask: MaskType, digits: string): string {
  switch (mask) {
    case 'cpf':     return formatCPF(digits);
    case 'cnpj':    return formatCNPJ(digits);
    case 'cpf_cnpj': return formatCPFCNPJ(digits);
    case 'phone':   return formatPhone(digits);
    case 'cep':     return formatCEP(digits);
  }
}

/**
 * Input com máscara automática ao digitar.
 * Aceita somente dígitos e formata conforme o tipo.
 *
 * @example
 * <MaskedInput mask="cpf" value={form.cpf} onChange={v => set('cpf', v)} />
 * <MaskedInput mask="phone" value={form.tel} onChange={v => set('tel', v)} />
 */
export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ mask, value, onChange, className, ...rest }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/\D/g, '').slice(0, MAX_DIGITS[mask]);
      onChange(applyMask(mask, raw));
    };

    const defaultCls =
      'w-full h-9 border border-slate-300 dark:border-slate-700 rounded-lg px-3 text-sm bg-white dark:bg-slate-900 dark:text-slate-100 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-colors';

    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        className={className ?? defaultCls}
        {...rest}
      />
    );
  },
);

MaskedInput.displayName = 'MaskedInput';
export default MaskedInput;
