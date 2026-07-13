import { useState, useEffect, useCallback } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { fmtBRL } from '../../utils/format';

type Dias = 30 | 60 | 90;

interface DiaFluxo {
  dia: string;
  entradas: number;
  saidas: number;
  saldo_acumulado: number;
}

interface FluxoCaixaResult {
  saldo_inicial: number;
  dias: number;
  serie: DiaFluxo[];
}

const fmtDataCurta = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
};

export default function FluxoCaixaPage() {
  const [dias, setDias] = useState<Dias>(30);
  const [result, setResult] = useState<FluxoCaixaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.get('/tenant/financeiro/fluxo-caixa', { params: { dias } })
      .then(r => setResult(r.data))
      .catch(() => setError('Erro ao carregar a projeção de fluxo de caixa.'))
      .finally(() => setLoading(false));
  }, [dias]);

  useEffect(() => { load(); }, [load]);

  const serie = result?.serie ?? [];
  const saldoFinal = serie.length > 0 ? serie[serie.length - 1].saldo_acumulado : (result?.saldo_inicial ?? 0);
  const totalEntradas = serie.reduce((s, d) => s + d.entradas, 0);
  const totalSaidas = serie.reduce((s, d) => s + d.saidas, 0);

  return (
    <Layout>
      <div className="space-y-5 animate-fade-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">Fluxo de Caixa</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Projeção de saldo a partir das contas a receber/pagar em aberto</p>
          </div>
          <div className="flex items-center gap-0.5 p-0.5 rounded-control bg-slate-100 dark:bg-slate-800 w-fit">
            {([30, 60, 90] as Dias[]).map(d => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className={`px-3 h-8 rounded-[7px] text-xs font-semibold transition-colors ${
                  dias === d ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {d} dias
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-card border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-card animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-2">Saldo atual</p>
                <p className="text-[25px] font-mono font-bold text-slate-900 dark:text-slate-100">{fmtBRL(result?.saldo_inicial ?? 0)}</p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-2">Entradas previstas</p>
                <p className="text-[25px] font-mono font-bold text-positive dark:text-positive-dark">{fmtBRL(totalEntradas)}</p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-2">Saídas previstas</p>
                <p className="text-[25px] font-mono font-bold text-negative">{fmtBRL(totalSaidas)}</p>
              </div>
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500">Saldo projetado</p>
                <p className={`text-sm font-mono font-bold ${saldoFinal >= 0 ? 'text-positive dark:text-positive-dark' : 'text-negative'}`}>
                  {fmtBRL(saldoFinal)} em {dias} dias
                </p>
              </div>
              {serie.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500 py-10 text-center">Nenhum título em aberto no período.</p>
              ) : (
                <SaldoChart serie={serie} />
              )}
            </div>

            <div className="card p-5 overflow-x-auto">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-3">Detalhamento por dia</p>
              {serie.length === 0 ? (
                <p className="text-sm text-slate-400 dark:text-slate-500">Nenhum título em aberto no período.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800">
                      <th className="text-left py-2 px-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Data</th>
                      <th className="text-right py-2 px-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Entradas</th>
                      <th className="text-right py-2 px-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Saídas</th>
                      <th className="text-right py-2 px-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Saldo acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serie.map(d => (
                      <tr key={d.dia} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-300">{fmtDataCurta(d.dia)}</td>
                        <td className="py-2 px-3 text-right font-mono text-positive dark:text-positive-dark">{d.entradas > 0 ? `+${fmtBRL(d.entradas)}` : '—'}</td>
                        <td className="py-2 px-3 text-right font-mono text-negative">{d.saidas > 0 ? `−${fmtBRL(d.saidas)}` : '—'}</td>
                        <td className={`py-2 px-3 text-right font-mono font-semibold ${d.saldo_acumulado >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-negative'}`}>{fmtBRL(d.saldo_acumulado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function SaldoChart({ serie }: { serie: DiaFluxo[] }) {
  const valores = serie.map(d => d.saldo_acumulado);
  const max = Math.max(...valores, 0);
  const min = Math.min(...valores, 0);
  const range = Math.max(1, max - min);
  const W = 700, H = 200, PAD = 24;
  const step = serie.length > 1 ? (W - PAD * 2) / (serie.length - 1) : 0;
  const points = valores.map((v, i) => {
    const x = PAD + step * i;
    const y = PAD + (1 - (v - min) / range) * (H - PAD * 2);
    return [x, y] as const;
  });
  const zeroY = PAD + (1 - (0 - min) / range) * (H - PAD * 2);
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0]},${zeroY} L${points[0][0]},${zeroY} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48">
        <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeDasharray="4 4" />
        <path d={areaPath} fill="rgb(var(--brand-500) / 0.12)" />
        <path d={linePath} fill="none" stroke="rgb(var(--brand-500))" strokeWidth={2} />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} fill={valores[i] >= 0 ? 'rgb(var(--brand-600))' : '#e25b4e'} />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
        <span>{fmtDataCurta(serie[0].dia)}</span>
        {serie.length > 2 && <span>{fmtDataCurta(serie[Math.floor(serie.length / 2)].dia)}</span>}
        <span>{fmtDataCurta(serie[serie.length - 1].dia)}</span>
      </div>
    </div>
  );
}
