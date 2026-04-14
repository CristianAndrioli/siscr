import { useState } from 'react';
import {
  cnaeDigitsFromInput,
  fetchCnaeSubclassePorCodigo,
  formatCnaeMascara,
} from '../../services/cnaeIbge';

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** classes Tailwind para o input principal */
  inputClassName: string;
  /** classes para texto de ajuda / descrição */
  hintClassName?: string;
  /** opcional: estilo do botão Consultar (padrão adequado para tema claro/escuro em configurações) */
  buttonClassName?: string;
};

const BTN_DEFAULT =
  'shrink-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * CNAE (subclasse, 7 dígitos) com consulta à API pública do IBGE para validar e exibir descrição.
 * Grava o valor no formato com máscara (ex.: 6201-5/01) quando há 7 dígitos; caso contrário mantém o que o usuário digitou.
 */
export function CnaeLookupInput({
  value,
  onChange,
  disabled,
  inputClassName,
  hintClassName = 'text-xs text-slate-500 dark:text-slate-400',
  buttonClassName = BTN_DEFAULT,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [descricao, setDescricao] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState('');

  const digits = cnaeDigitsFromInput(value);
  const display = digits.length > 0 ? formatCnaeMascara(digits) : value;

  const applyChange = (raw: string) => {
    setDescricao(null);
    setLookupError('');
    const d = cnaeDigitsFromInput(raw);
    if (d.length === 7) {
      onChange(formatCnaeMascara(d));
    } else if (d.length === 0) {
      onChange('');
    } else {
      onChange(d);
    }
  };

  const consultarIbge = async () => {
    if (digits.length !== 7) {
      setLookupError('Informe os 7 dígitos da subclasse CNAE.');
      setDescricao(null);
      return;
    }
    setLoading(true);
    setLookupError('');
    setDescricao(null);
    try {
      const info = await fetchCnaeSubclassePorCodigo(digits);
      if (info) {
        setDescricao(info.descricao);
        onChange(formatCnaeMascara(info.codigo));
      } else {
        setLookupError('Código não encontrado na tabela CNAE do IBGE.');
      }
    } catch {
      setLookupError('Não foi possível consultar o IBGE. Tente de novo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={display}
          onChange={(e) => applyChange(e.target.value)}
          placeholder="6201-5/01 ou 6201501"
          maxLength={9}
          className={inputClassName}
        />
        <button
          type="button"
          disabled={disabled || loading || digits.length !== 7}
          onClick={() => void consultarIbge()}
          className={buttonClassName}
        >
          {loading ? 'Consultando…' : 'Consultar IBGE'}
        </button>
      </div>
      <p className={hintClassName}>
        Digite os 7 dígitos (com ou sem máscara) e use &quot;Consultar IBGE&quot; para validar e ver a descrição oficial.
        Os dados vêm da API pública de CNAE do IBGE (subclasse).
      </p>
      {descricao && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400/90 leading-snug border border-emerald-800/40 rounded-lg px-2 py-1.5 bg-emerald-950/20">
          {descricao}
        </p>
      )}
      {lookupError && <p className="text-xs text-red-400">{lookupError}</p>}
    </div>
  );
}
