import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export interface PessoaResult {
  id: string;
  nome: string;
  cpf_cnpj: string;
  tipo_cadastro: string;
}

interface Props {
  value?: string;
  displayValue?: string;
  onChange: (id: string, nome: string) => void;
  tipoCadastro?: 'cliente' | 'fornecedor' | 'transportadora';
  placeholder?: string;
  className?: string;
}

/** Quantas pessoas listar quando o campo é aberto sem nenhum termo digitado. */
const LIMITE_LISTA_INICIAL = 20;

/**
 * Campo de busca de pessoa com autocomplete.
 * Abordagem padrão ERP: digita nome ou CPF/CNPJ, lista aparece embaixo.
 * Ao clicar no campo vazio a lista já abre com os primeiros cadastros,
 * para que o campo não pareça inerte quando o usuário ainda não sabe o nome.
 */
export function PessoaBusca({ value, displayValue, onChange, tipoCadastro, placeholder = 'Buscar por nome ou CPF/CNPJ...', className = '' }: Props) {
  const [query, setQuery] = useState(displayValue ?? '');
  const [resultados, setResultados] = useState<PessoaResult[]>([]);
  const [aberto, setAberto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sincroniza quando displayValue muda externamente
  useEffect(() => {
    if (displayValue !== undefined) setQuery(displayValue);
  }, [displayValue]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buscar = (q: string, { imediato = false }: { imediato?: boolean } = {}) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const executar = async () => {
      setLoading(true);
      try {
        const params: Record<string, string> = {};
        if (q.trim()) params.busca = q;
        else params.limit = String(LIMITE_LISTA_INICIAL);
        if (tipoCadastro) params.tipoCadastro = tipoCadastro;
        const res = await api.get('/tenant/cadastros/pessoas', { params });
        setResultados(res.data.pessoas ?? []);
      } catch {
        setResultados([]);
      } finally {
        setBuscou(true);
        setLoading(false);
        setAberto(true);
      }
    };
    if (imediato) void executar();
    else debounceRef.current = setTimeout(executar, 300);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    // Limpa seleção atual ao digitar
    if (value) onChange('', '');
    buscar(e.target.value);
  };

  const handleFocus = () => {
    if (resultados.length > 0) setAberto(true);
    else buscar(query, { imediato: true });
  };

  const selecionar = (p: PessoaResult) => {
    setQuery(p.nome);
    setAberto(false);
    setResultados([]);
    onChange(p.id, p.nome);
  };

  const limpar = () => {
    setQuery('');
    setResultados([]);
    setBuscou(false);
    setAberto(false);
    onChange('', '');
  };

  const rotulo = tipoCadastro ?? 'cadastro';

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          value={query}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 pr-8 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 placeholder-slate-400"
        />
        {query && (
          <button type="button" onClick={limpar} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">
            <svg className="animate-spin w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </span>
        )}
      </div>

      {aberto && buscou && resultados.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl px-4 py-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {query.trim()
              ? `Nenhum ${rotulo} encontrado para “${query.trim()}”.`
              : `Nenhum ${rotulo} cadastrado ainda.`}
          </p>
        </div>
      )}

      {aberto && resultados.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {resultados.map(p => (
            <button key={p.id} type="button" onMouseDown={() => selecionar(p)}
              className="w-full text-left px-4 py-2.5 hover:bg-brand-50 dark:hover:bg-brand-950 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{p.nome}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{p.cpf_cnpj || p.tipo_cadastro}</div>
            </button>
          ))}
        </div>
      )}

      {/* Selecionado */}
      {value && (
        <p className="text-xs text-brand-600 dark:text-brand-400 mt-1 font-medium flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
          Selecionado
        </p>
      )}
    </div>
  );
}

export default PessoaBusca;
