import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../../components/Layout';
import { bancarioService, ContaBancaria, ConciliacaoItemInput, SugestaoMatch } from '../../services/bancario';
import { parseOFXFile, OFXResult, ofxSummary } from '../../utils/ofxParser';

// ─── Icons ────────────────────────────────────────────────────────

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const icons = {
  check: 'M4.5 12.75l6 6 9-13.5',
  link: 'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
  x: 'M6 18L18 6M6 6l12 12',
  upload: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
  search: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607',
  bank: 'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z',
  warning: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
  arrow: 'M8.25 4.5l7.5 7.5-7.5 7.5',
  eye: 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  plus: 'M12 4.5v15m7.5-7.5h-15',
};

// ─── Helpers ──────────────────────────────────────────────────────

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(d: string) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function Badge({ color, children }: { color: 'green' | 'red' | 'yellow' | 'gray' | 'blue'; children: React.ReactNode }) {
  const cls = {
    green: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    red:   'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    yellow:'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    gray:  'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    blue:  'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {children}
    </span>
  );
}

// ─── Step indicator ───────────────────────────────────────────────

const STEPS = ['Conta', 'Arquivo', 'Revisar', 'Confirmar'];

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                done   ? 'bg-brand-600 border-brand-600 text-white' :
                active ? 'border-brand-600 text-brand-600 bg-white dark:bg-slate-900' :
                         'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900'
              }`}>
                {done ? <Icon d={icons.check} className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`mt-1 text-xs font-medium ${active ? 'text-brand-600 dark:text-brand-400' : done ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mt-[-14px] transition-colors ${done ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Item decision type ───────────────────────────────────────────

type ItemDecision = {
  acao: 'conciliar' | 'ignorar' | 'manual' | null;
  origem_tipo?: 'contas_receber' | 'contas_pagar';
  origem_id?: string;
  origem_desc?: string;
};

// ─── Step 1: Account selection ────────────────────────────────────

function Step1({ contas, selected, onSelect, onNext }: {
  contas: ContaBancaria[];
  selected: ContaBancaria | null;
  onSelect: (c: ContaBancaria) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Selecionar conta bancária</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Escolha a conta cujo extrato será importado.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {contas.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              selected?.id === c.id
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                selected?.id === c.id ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                <Icon d={icons.bank} className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm text-slate-800 dark:text-slate-100 truncate">{c.nome}</div>
                <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
                  {c.banco_nome ?? 'Sem banco'}{c.agencia ? ` · Ag. ${c.agencia}` : ''}{c.conta ? ` · Cc. ${c.conta}` : ''}
                </div>
                <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {fmtCurrency(c.saldo_atual)}
                </div>
              </div>
              {selected?.id === c.id && (
                <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center flex-none">
                  <Icon d={icons.check} className="w-3 h-3 text-white" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Method hint */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden mt-2">
        <div className="flex">
          <button className="flex-1 flex items-center gap-3 p-4 bg-brand-50 dark:bg-brand-950 border-r border-brand-200 dark:border-brand-800">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center flex-none">
              <Icon d={icons.upload} className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">Importar arquivo OFX</div>
              <div className="text-xs text-brand-500 dark:text-brand-400">Exporte do seu banco e importe aqui</div>
            </div>
          </button>
          <div className="flex-1 flex items-center gap-3 p-4 opacity-50 cursor-not-allowed">
            <div className="w-9 h-9 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-none">
              <Icon d={icons.link} className="w-4.5 h-4.5 text-slate-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-slate-500 dark:text-slate-400">Integração bancária</div>
              <div className="text-xs text-slate-400 dark:text-slate-500">Em desenvolvimento</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!selected}
          className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: File upload ──────────────────────────────────────────

function Step2({
  onParsed,
  onBack,
}: {
  onParsed: (result: OFXResult, file: File) => void;
  onBack: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(ofx|qfx|ofc)$/i)) {
      setError('Formato inválido. Selecione um arquivo .OFX ou .QFX.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await parseOFXFile(file);
      onParsed(result, file);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onParsed]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Importar extrato OFX</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
          Exporte o extrato do seu banco no formato OFX e selecione o arquivo abaixo.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
          dragging
            ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
            : 'border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-600 bg-slate-50 dark:bg-slate-900'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".ofx,.qfx,.ofc"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 animate-spin text-brand-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm text-slate-500 dark:text-slate-400">Analisando arquivo…</span>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-xl bg-brand-100 dark:bg-brand-900 flex items-center justify-center">
              <Icon d={icons.upload} className="w-7 h-7 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Arraste e solte ou clique para selecionar</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Formatos suportados: .OFX, .QFX</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
          <Icon d={icons.warning} className="w-4 h-4 mt-0.5 flex-none" />
          {error}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Como exportar o OFX do seu banco</p>
        <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 list-disc list-inside">
          <li><strong>Bradesco / Santander:</strong> Extratos → Exportar → Formato OFX</li>
          <li><strong>Itaú:</strong> Extrato → Download → Internet Banking (OFX)</li>
          <li><strong>Banco do Brasil:</strong> Movimentações → Exportar Extrato → OFX</li>
          <li><strong>Nubank / Inter:</strong> Perfil → Exportar dados → OFX</li>
          <li><strong>Sicoob / Sicredi:</strong> Conta corrente → Exportar extrato → OFX</li>
        </ul>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          Voltar
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Two-panel reconciliation ────────────────────────────

type LeftFilter = 'all' | 'pendente' | 'vinculado' | 'ignorado';
type RightFilter = 'all' | 'contas_receber' | 'contas_pagar';

function StatusPill({ acao }: { acao: string | null | undefined }) {
  if (acao === 'conciliar') return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">vinculado</span>;
  if (acao === 'ignorar')   return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">ignorado</span>;
  if (acao === 'manual')    return <span className="inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">manual</span>;
  return null;
}

function Step3({
  ofxResult,
  decisions,
  sugestoes,
  fitidsDuplicados,
  loadingSugestoes,
  onDecide,
  onBack,
  onNext,
}: {
  ofxResult: OFXResult;
  conta: ContaBancaria;
  decisions: Record<string, ItemDecision>;
  sugestoes: Record<string, SugestaoMatch[]>;
  fitidsDuplicados: string[];
  loadingSugestoes: boolean;
  onDecide: (fitid: string, d: ItemDecision) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [selectedFitid, setSelectedFitid] = useState<string | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<SugestaoMatch | null>(null);
  const [leftSearch, setLeftSearch]   = useState('');
  const [leftFilter, setLeftFilter]   = useState<LeftFilter>('pendente');
  const [rightSearch, setRightSearch] = useState('');
  const [rightFilter, setRightFilter] = useState<RightFilter>('all');

  const selectedOFXTrn = useMemo(
    () => ofxResult.transactions.find(t => t.fitid === selectedFitid),
    [ofxResult.transactions, selectedFitid],
  );

  const delta = selectedOFXTrn && selectedMatch
    ? Math.abs(selectedOFXTrn.valor - selectedMatch.valor)
    : null;
  const deltaOk = delta !== null && delta < 0.02;

  // IDs already consumed by decisions
  const linkedIds = useMemo(() => new Set(
    Object.values(decisions)
      .filter(d => d.acao === 'conciliar' && d.origem_id)
      .map(d => d.origem_id!),
  ), [decisions]);

  // Full deduplicated pool from all suggestions
  const allPool = useMemo(() => {
    const seen = new Set<string>();
    const recs: SugestaoMatch[] = [];
    for (const ms of Object.values(sugestoes)) {
      for (const m of (ms as SugestaoMatch[])) {
        if (!seen.has(m.id)) { seen.add(m.id); recs.push(m); }
      }
    }
    return recs.sort((a, b) => a.data.localeCompare(b.data));
  }, [sugestoes]);

  // Suggestions for the currently selected OFX line
  const currentSugg = useMemo(
    () => selectedFitid ? (sugestoes[selectedFitid] ?? []) as SugestaoMatch[] : [],
    [selectedFitid, sugestoes],
  );
  const suggestedIds = useMemo(() => new Set(currentSugg.map(s => s.id)), [currentSugg]);

  // Right panel: current suggestions first, then rest of pool
  const rightPool = useMemo(() => {
    if (!selectedFitid) return allPool;
    const curIds = new Set(currentSugg.map(s => s.id));
    return [...currentSugg, ...allPool.filter(r => !curIds.has(r.id))];
  }, [selectedFitid, currentSugg, allPool]);

  // ── Filtered lists ────────────────────────────────────────────────

  const filteredLeft = ofxResult.transactions.filter(t => {
    const dec = decisions[t.fitid];
    if (leftFilter === 'pendente'  && dec?.acao) return false;
    if (leftFilter === 'vinculado' && dec?.acao !== 'conciliar') return false;
    if (leftFilter === 'ignorado'  && dec?.acao !== 'ignorar' && dec?.acao !== 'manual') return false;
    if (leftSearch) {
      const q = leftSearch.toLowerCase();
      if (!t.descricao.toLowerCase().includes(q) && !t.fitid.includes(q)) return false;
    }
    return true;
  });

  const filteredRight = rightPool.filter(r => {
    if (rightFilter !== 'all' && r.tipo !== rightFilter) return false;
    // Hide records already linked to other OFX lines (unless it's the currently selected match)
    if (linkedIds.has(r.id) && selectedMatch?.id !== r.id) return false;
    if (rightSearch) {
      const q = rightSearch.toLowerCase();
      if (
        !r.descricao.toLowerCase().includes(q) &&
        !(r.pessoa_nome ?? '').toLowerCase().includes(q) &&
        !String(r.valor).includes(q)
      ) return false;
    }
    return true;
  });

  // ── Handlers ──────────────────────────────────────────────────────

  const handleSelectOFX = (fitid: string) => {
    if (decisions[fitid]?.acao) return; // already decided — not interactive
    if (fitid === selectedFitid) { setSelectedFitid(null); setSelectedMatch(null); return; }
    setSelectedFitid(fitid);
    const sug = (sugestoes[fitid] ?? []) as SugestaoMatch[];
    const top = sug.find(s => !linkedIds.has(s.id));
    setSelectedMatch(top && top.score >= 60 ? top : null);
  };

  const handleVincular = () => {
    if (!selectedFitid || !selectedMatch) return;
    onDecide(selectedFitid, {
      acao: 'conciliar',
      origem_tipo: selectedMatch.tipo,
      origem_id: selectedMatch.id,
      origem_desc: `${selectedMatch.tipo === 'contas_receber' ? 'CR' : 'CP'} · ${selectedMatch.descricao}${selectedMatch.pessoa_nome ? ` · ${selectedMatch.pessoa_nome}` : ''} · ${fmtCurrency(selectedMatch.valor)}`,
    });
    setSelectedFitid(null); setSelectedMatch(null);
  };

  const handleIgnorar = () => {
    if (!selectedFitid) return;
    onDecide(selectedFitid, { acao: 'ignorar' });
    setSelectedFitid(null); setSelectedMatch(null);
  };

  const handleManual = () => {
    if (!selectedFitid) return;
    onDecide(selectedFitid, { acao: 'manual' });
    setSelectedFitid(null); setSelectedMatch(null);
  };

  const handleUndoDecision = (fitid: string) => {
    onDecide(fitid, { acao: null });
  };

  // ── Counters ──────────────────────────────────────────────────────

  const pending   = ofxResult.transactions.filter(t => !decisions[t.fitid]?.acao);
  const countVinc = Object.values(decisions).filter(d => d.acao === 'conciliar').length;
  const countIgn  = Object.values(decisions).filter(d => d.acao === 'ignorar').length;
  const countMan  = Object.values(decisions).filter(d => d.acao === 'manual').length;
  const allDecided = pending.length === 0;
  const canVincular = !!selectedFitid && !!selectedMatch;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Vincular transações</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">
          Selecione uma linha do extrato (esquerda) e o lançamento correspondente (direita), depois clique em <strong>Vincular</strong>.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total',      v: ofxResult.transactions.length, cls: 'text-slate-700 dark:text-slate-200' },
          { label: 'Pendentes',  v: pending.length,  cls: 'text-amber-600 dark:text-amber-400' },
          { label: 'Vinculados', v: countVinc,        cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Ignorados',  v: countIgn + countMan, cls: 'text-slate-400 dark:text-slate-500' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-center">
            <div className={`text-xl font-bold ${s.cls}`}>{s.v}</div>
            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {loadingSugestoes && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
          <svg className="w-4 h-4 animate-spin text-brand-600 flex-none" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Buscando sugestões de vinculação…
        </div>
      )}

      {/* ── Two-panel ── */}
      <div className="grid grid-cols-[1fr_32px_1fr] gap-0 items-stretch">

        {/* ──── Left: OFX transactions ──── */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-none">
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Extrato bancário (OFX)</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Selecione uma linha do banco</p>
            </div>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-900">
              {ofxResult.transactions.length} linhas
            </span>
          </div>
          {/* Search + filter */}
          <div className="flex gap-1.5 px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 flex-none">
            <div className="relative flex-1">
              <Icon d={icons.search} className="absolute left-2 top-[7px] w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                value={leftSearch}
                onChange={e => setLeftSearch(e.target.value)}
                placeholder="Buscar…"
                className="w-full pl-6 pr-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <select
              value={leftFilter}
              onChange={e => setLeftFilter(e.target.value as LeftFilter)}
              className="text-[11px] px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="vinculado">Vinculados</option>
              <option value="ignorado">Ignorados</option>
            </select>
          </div>
          {/* List */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: '44vh' }}>
            {filteredLeft.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">Nenhuma transação.</div>
            ) : filteredLeft.map(t => {
              const dec = decisions[t.fitid];
              const isSelected = selectedFitid === t.fitid;
              const isDone = !!dec?.acao;
              const isCr = t.tipo === 'credito';
              const isDup = fitidsDuplicados.includes(t.fitid);

              return (
                <div
                  key={t.fitid}
                  onClick={() => isDone ? undefined : handleSelectOFX(t.fitid)}
                  className={[
                    'flex items-start gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 transition-colors',
                    isDone
                      ? 'opacity-60 cursor-default'
                      : isSelected
                        ? 'bg-brand-50 dark:bg-brand-950 cursor-pointer border-l-2 !border-l-brand-500'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer',
                  ].join(' ')}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-none mt-0.5 text-[10px] font-bold ${
                    isCr ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                         : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  }`}>
                    {isCr ? '+' : '−'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate max-w-[110px]">{t.descricao}</span>
                      {isDup && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">dup</span>}
                      {dec && <StatusPill acao={dec.acao} />}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{fmtDate(t.data)}</div>
                    {dec?.acao === 'conciliar' && dec.origem_desc && (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">↔ {dec.origem_desc}</div>
                    )}
                  </div>
                  <div className="flex-none flex flex-col items-end gap-1">
                    <span className={`text-xs font-bold ${isCr ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {isCr ? '+' : '−'}{fmtCurrency(t.valor)}
                    </span>
                    {isDone && (
                      <button
                        onClick={e => { e.stopPropagation(); handleUndoDecision(t.fitid); }}
                        className="text-[9px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline"
                      >
                        desfazer
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ──── Connector column ──── */}
        <div className="flex flex-col items-center py-8 gap-1 self-stretch">
          <div className="flex-1 w-px bg-slate-200 dark:bg-slate-700" />
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
            canVincular
              ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-400 dark:border-emerald-600'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}>
            <Icon d={icons.link} className={`w-3.5 h-3.5 ${canVincular ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
          </div>
          <div className="flex-1 w-px bg-slate-200 dark:bg-slate-700" />
        </div>

        {/* ──── Right: CR/CP records ──── */}
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-none">
            <div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Lançamentos financeiros</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {selectedFitid
                  ? currentSugg.length > 0
                    ? `${currentSugg.length} sugestão${currentSugg.length > 1 ? 'ões' : ''} para esta linha`
                    : 'Nenhuma sugestão — selecione manualmente'
                  : 'Selecione uma linha do extrato'}
              </p>
            </div>
            <select
              value={rightFilter}
              onChange={e => setRightFilter(e.target.value as RightFilter)}
              className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">CR + CP</option>
              <option value="contas_receber">Só CR</option>
              <option value="contas_pagar">Só CP</option>
            </select>
          </div>
          {/* Search */}
          <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 flex-none">
            <div className="relative">
              <Icon d={icons.search} className="absolute left-2 top-[7px] w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                value={rightSearch}
                onChange={e => setRightSearch(e.target.value)}
                placeholder="Buscar por nome, valor…"
                className="w-full pl-6 pr-2 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          {/* List */}
          <div className="overflow-y-auto flex-1" style={{ maxHeight: '44vh' }}>
            {!selectedFitid ? (
              <div className="py-10 text-center text-xs text-slate-400 dark:text-slate-500 px-4">
                ← Selecione uma linha do extrato para ver sugestões
              </div>
            ) : filteredRight.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500 px-4">
                Nenhum lançamento encontrado.<br />
                Use <span className="font-semibold">Baixar sem vínculo</span> para criar um movimento avulso.
              </div>
            ) : filteredRight.map(r => {
              const isSelected = selectedMatch?.id === r.id;
              const isSugg = suggestedIds.has(r.id);
              const isCr   = r.tipo === 'contas_receber';

              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedMatch(isSelected ? null : r)}
                  className={[
                    'flex items-start gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950 border-l-2 !border-l-emerald-500'
                      : isSugg
                        ? 'bg-brand-50/60 dark:bg-brand-950/40 hover:bg-brand-50 dark:hover:bg-brand-950'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-none mt-0.5 text-[9px] font-bold ${
                    isCr ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                         : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                  }`}>
                    {isCr ? 'CR' : 'CP'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-100 truncate max-w-[100px]">{r.descricao}</span>
                      {isSugg && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-300">sugerido</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {r.pessoa_nome ? `${r.pessoa_nome} · ` : ''}{fmtDate(r.data)}
                    </div>
                  </div>
                  <div className="flex-none text-right">
                    <div className={`text-xs font-bold ${isCr ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {fmtCurrency(r.valor)}
                    </div>
                    {isSugg && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500">{r.score}%</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Delta footer ── */}
      {(selectedFitid || selectedMatch) && (
        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <div className={`px-3 py-2 rounded-xl border text-xs ${
            selectedOFXTrn
              ? 'border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
          }`}>
            {selectedOFXTrn ? (
              <>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Extrato selecionado</div>
                <div className={`font-bold ${selectedOFXTrn.tipo === 'credito' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {selectedOFXTrn.tipo === 'credito' ? '+' : '−'}{fmtCurrency(selectedOFXTrn.valor)}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">{fmtDate(selectedOFXTrn.data)}</div>
              </>
            ) : <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>}
          </div>

          <div className={`px-3 py-2 rounded-xl border text-center min-w-[80px] ${
            delta === null
              ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
              : deltaOk
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950'
                : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950'
          }`}>
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Δ diferença</div>
            <div className={`text-xs font-bold ${
              delta === null ? 'text-slate-400'
              : deltaOk ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
            }`}>
              {delta === null ? '—' : deltaOk ? 'R$ 0,00 ✓' : fmtCurrency(delta)}
            </div>
          </div>

          <div className={`px-3 py-2 rounded-xl border text-xs ${
            selectedMatch
              ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
          }`}>
            {selectedMatch ? (
              <>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Lançamento selecionado</div>
                <div className={`font-bold ${selectedMatch.tipo === 'contas_receber' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {fmtCurrency(selectedMatch.valor)}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {selectedMatch.pessoa_nome ?? selectedMatch.descricao}
                </div>
              </>
            ) : <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>}
          </div>
        </div>
      )}

      {/* ── Action bar ── */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onBack}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Voltar
          </button>
          {selectedFitid && (
            <>
              <button
                onClick={handleIgnorar}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Ignorar linha
              </button>
              <button
                onClick={handleManual}
                className="px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950 transition-colors"
              >
                Baixar sem vínculo
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleVincular}
            disabled={!canVincular}
            title={!canVincular ? 'Selecione uma linha de cada painel' : ''}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <Icon d={icons.link} className="w-4 h-4" />
            Vincular ↔
          </button>
          <button
            onClick={onNext}
            disabled={!allDecided}
            title={!allDecided ? `${pending.length} transação${pending.length > 1 ? 'ões' : ''} sem decisão` : ''}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {allDecided ? 'Confirmar →' : `${pending.length} pendente${pending.length > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Confirm ──────────────────────────────────────────────

function Step4({
  ofxResult,
  conta,
  decisions,
  submitting,
  onBack,
  onConfirm,
}: {
  ofxResult: OFXResult;
  conta: ContaBancaria;
  decisions: Record<string, ItemDecision>;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const conciliar = Object.values(decisions).filter(d => d.acao === 'conciliar').length;
  const ignorar   = Object.values(decisions).filter(d => d.acao === 'ignorar').length;
  const manual    = Object.values(decisions).filter(d => d.acao === 'manual').length;
  const summary   = ofxSummary(ofxResult);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Confirmar importação</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Revise o resumo antes de finalizar.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
        {[
          { label: 'Conta bancária', value: conta.nome },
          { label: 'Período', value: ofxResult.dateStart && ofxResult.dateEnd ? `${fmtDate(ofxResult.dateStart)} → ${fmtDate(ofxResult.dateEnd)}` : '—' },
          { label: 'Saldo final (extrato)', value: ofxResult.balAmount != null ? fmtCurrency(ofxResult.balAmount) : '—' },
          { label: 'Total de transações', value: summary.total },
          { label: 'Créditos', value: `${summary.totalCreditos} · ${fmtCurrency(summary.valorCreditos)}` },
          { label: 'Débitos', value: `${summary.totalDebitos} · ${fmtCurrency(summary.valorDebitos)}` },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">{row.label}</span>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{String(row.value)}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{conciliar}</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Vinculados</div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">{manual}</div>
          <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Manuais</div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-slate-600 dark:text-slate-300">{ignorar}</div>
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Ignorados</div>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
        <Icon d={icons.warning} className="w-4 h-4 mt-0.5 flex-none" />
        <span>
          Os registros <strong>{manual} manuais</strong> serão criados como movimentos bancários.
          Esta ação não pode ser desfeita. Conciliações podem ser visualizadas no histórico da conta.
        </span>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} disabled={submitting} className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors">
          Voltar
        </button>
        <button
          onClick={onConfirm}
          disabled={submitting}
          className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {submitting ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Finalizando…
            </>
          ) : (
            'Finalizar conciliação'
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────

export function ConciliacaoWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialContaId = searchParams.get('contaId');

  const [step, setStep] = useState(0);
  const [contas, setContas] = useState<ContaBancaria[]>([]);
  const [selectedConta, setSelectedConta] = useState<ContaBancaria | null>(null);
  const [ofxResult, setOfxResult] = useState<OFXResult | null>(null);
  const [ofxFileName, setOfxFileName] = useState('');
  const [decisions, setDecisions] = useState<Record<string, ItemDecision>>({});
  const [sugestoes, setSugestoes] = useState<Record<string, SugestaoMatch[]>>({});
  const [fitidsDuplicados, setFitidsDuplicados] = useState<string[]>([]);
  const [loadingSugestoes, setLoadingSugestoes] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load accounts
  useEffect(() => {
    bancarioService.listContas().then(cs => {
      const ativas = cs.filter(c => c.ativo);
      setContas(ativas);
      if (initialContaId) {
        const found = ativas.find(c => c.id === initialContaId);
        if (found) setSelectedConta(found);
      }
    });
  }, [initialContaId]);

  const handleParsed = useCallback(async (result: OFXResult, file: File) => {
    setOfxResult(result);
    setOfxFileName(file.name);
    setStep(2);

    // Fetch suggestions
    if (selectedConta) {
      setLoadingSugestoes(true);
      try {
        const payload = result.transactions.map(t => ({
          fitid: t.fitid,
          tipo: t.tipo,
          valor: t.valor,
          data: t.data,
          descricao: t.descricao,
        }));
        const res = await bancarioService.getSugestoes({ conta_bancaria_id: selectedConta.id, transacoes: payload });
        setSugestoes(res.sugestoes);
        setFitidsDuplicados(res.fitids_duplicados);

        // Auto-apply top suggestion if score >= 75
        const autoDec: Record<string, ItemDecision> = {};
        for (const [fitid, matches] of Object.entries(res.sugestoes)) {
          const top = (matches as SugestaoMatch[])[0];
          if (top && top.score >= 75) {
            autoDec[fitid] = {
              acao: 'conciliar',
              origem_tipo: top.tipo,
              origem_id: top.id,
              origem_desc: `${top.tipo === 'contas_receber' ? 'CR' : 'CP'} · ${top.descricao} · ${fmtCurrency(top.valor)} · ${fmtDate(top.data)}`,
            };
          }
        }
        setDecisions(autoDec);
      } catch (_) {
        // sugestões são opcionais
      } finally {
        setLoadingSugestoes(false);
      }
    }
  }, [selectedConta]);

  const handleDecide = useCallback((fitid: string, d: ItemDecision) => {
    setDecisions(prev => ({ ...prev, [fitid]: d }));
  }, []);

  const handleConfirm = async () => {
    if (!selectedConta || !ofxResult) return;
    setSubmitting(true);
    try {
      const itens: ConciliacaoItemInput[] = ofxResult.transactions.map(t => {
        const dec = decisions[t.fitid];
        return {
          ofx_fitid: t.fitid,
          tipo: t.tipo,
          valor: t.valor,
          data: t.data,
          descricao: t.descricao,
          acao: dec?.acao ?? 'ignorar',
          origem_tipo: dec?.origem_tipo,
          origem_id: dec?.origem_id,
        };
      });

      const res = await bancarioService.criarConciliacao({
        conta_bancaria_id: selectedConta.id,
        arquivo_nome: ofxFileName,
        data_inicio: ofxResult.dateStart,
        data_fim: ofxResult.dateEnd,
        saldo_inicial: undefined,
        saldo_final: ofxResult.balAmount,
        itens,
      });

      // Navigate to account detail with success message
      navigate(`/financeiro/contas-bancarias/${selectedConta.id}?conciliacao=${res.id}&ok=1`);
    } catch (e) {
      alert('Erro ao finalizar a conciliação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 font-display">Conciliação Bancária</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-0.5">Importe um extrato OFX e vincule as transações ao financeiro.</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm">
          <StepBar current={step} />

          {step === 0 && (
            <Step1
              contas={contas}
              selected={selectedConta}
              onSelect={setSelectedConta}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <Step2
              onParsed={handleParsed}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && ofxResult && selectedConta && (
            <Step3
              ofxResult={ofxResult}
              conta={selectedConta}
              decisions={decisions}
              sugestoes={sugestoes}
              fitidsDuplicados={fitidsDuplicados}
              loadingSugestoes={loadingSugestoes}
              onDecide={handleDecide}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && ofxResult && selectedConta && (
            <Step4
              ofxResult={ofxResult}
              conta={selectedConta}
              decisions={decisions}
              submitting={submitting}
              onBack={() => setStep(2)}
              onConfirm={handleConfirm}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

export default ConciliacaoWizard;
