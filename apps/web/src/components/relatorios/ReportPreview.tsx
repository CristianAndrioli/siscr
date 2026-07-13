import type { RelatorioQueryResult, RelatorioVisualizacao, FonteInfo } from '../../services/relatorios';

/** Paleta de séries do preview — acento + cores fixas do handoff de redesign. */
const PALETTE = ['rgb(var(--brand-500))', '#b7e549', '#e8a33d', '#4e8fe2', '#e25b4e', '#9b7ede'];

function fmtValue(v: unknown, type: 'text' | 'number' | 'date' | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  if (type === 'number') {
    const n = Number(v);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(v);
  }
  return String(v);
}

interface GroupRow { grupo: string; registros: number; total?: number }

export default function ReportPreview({
  result, visualizacao, fonteInfo, colunas,
}: {
  result: RelatorioQueryResult | null;
  visualizacao: RelatorioVisualizacao;
  fonteInfo: FonteInfo | null;
  colunas: string[];
}) {
  if (!result) {
    return <p className="text-sm text-slate-400 dark:text-slate-500 py-16 text-center">Configure a fonte de dados para gerar a prévia.</p>;
  }

  if (result.linhas.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500 py-16 text-center">Nenhum registro encontrado para esse período.</p>;
  }

  if (result.agrupado) {
    const rows = result.linhas as unknown as GroupRow[];
    const hasTotal = rows.some(r => r.total !== undefined && r.total !== null);

    if (visualizacao === 'tabela' || !hasChartSupport(visualizacao)) {
      return <GroupTable rows={rows} hasTotal={hasTotal} />;
    }
    if (visualizacao === 'barras') return <BarChart rows={rows} hasTotal={hasTotal} />;
    if (visualizacao === 'linha') return <LineChart rows={rows} hasTotal={hasTotal} />;
    if (visualizacao === 'pizza') return <PieChart rows={rows} hasTotal={hasTotal} />;
  }

  return <RowsTable rows={result.linhas} colunas={colunas} fonteInfo={fonteInfo} />;
}

function hasChartSupport(v: RelatorioVisualizacao) {
  return v === 'barras' || v === 'linha' || v === 'pizza';
}

function GroupTable({ rows, hasTotal }: { rows: GroupRow[]; hasTotal: boolean }) {
  const totalGeral = rows.reduce((s, r) => s + (r.total ?? 0), 0);
  const totalRegistros = rows.reduce((s, r) => s + r.registros, 0);
  return (
    <table className="min-w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 dark:border-slate-800">
          <th className="text-left py-2 px-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Grupo</th>
          <th className="text-right py-2 px-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Registros</th>
          {hasTotal && <th className="text-right py-2 px-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">Total</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
            <td className="py-2 px-3 text-slate-700 dark:text-slate-200">{r.grupo ?? '—'}</td>
            <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">{r.registros}</td>
            {hasTotal && <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">{fmtValue(r.total, 'number')}</td>}
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-semibold">
          <td className="py-2 px-3 text-slate-800 dark:text-slate-100">Total</td>
          <td className="py-2 px-3 text-right font-mono text-brand-600 dark:text-brand-400">{totalRegistros}</td>
          {hasTotal && <td className="py-2 px-3 text-right font-mono text-brand-600 dark:text-brand-400">{fmtValue(totalGeral, 'number')}</td>}
        </tr>
      </tfoot>
    </table>
  );
}

function RowsTable({ rows, colunas, fonteInfo }: { rows: Record<string, unknown>[]; colunas: string[]; fonteInfo: FonteInfo | null }) {
  const numericCols = colunas.filter(k => fonteInfo?.colunas[k]?.type === 'number');
  const totals = Object.fromEntries(numericCols.map(k => [k, rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)]));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800">
            {colunas.map(k => (
              <th key={k} className="text-left py-2 px-3 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 whitespace-nowrap">
                {fonteInfo?.colunas[k]?.label ?? k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40">
              {colunas.map(k => (
                <td key={k} className={`py-2 px-3 whitespace-nowrap ${fonteInfo?.colunas[k]?.type === 'number' ? 'text-right font-mono text-slate-600 dark:text-slate-300' : 'text-slate-700 dark:text-slate-200'}`}>
                  {fmtValue(r[k], fonteInfo?.colunas[k]?.type)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {numericCols.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-semibold">
              {colunas.map((k, i) => (
                <td key={k} className={`py-2 px-3 ${numericCols.includes(k) ? 'text-right font-mono text-brand-600 dark:text-brand-400' : 'text-slate-800 dark:text-slate-100'}`}>
                  {i === 0 ? 'Total' : numericCols.includes(k) ? fmtValue(totals[k], 'number') : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function BarChart({ rows, hasTotal }: { rows: GroupRow[]; hasTotal: boolean }) {
  const values = rows.map(r => (hasTotal ? (r.total ?? 0) : r.registros));
  const max = Math.max(1, ...values);
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-700 dark:text-slate-200 truncate">{r.grupo ?? '—'}</span>
            <span className="font-mono text-slate-500 dark:text-slate-400">{hasTotal ? fmtValue(r.total, 'number') : r.registros}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(3, ((hasTotal ? (r.total ?? 0) : r.registros) / max) * 100)}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ rows, hasTotal }: { rows: GroupRow[]; hasTotal: boolean }) {
  const values = rows.map(r => (hasTotal ? (r.total ?? 0) : r.registros));
  const max = Math.max(1, ...values);
  const W = 560, H = 180, PAD = 24;
  const step = rows.length > 1 ? (W - PAD * 2) / (rows.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = PAD + step * i;
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return [x, y] as const;
  });
  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0]},${H - PAD} L${points[0][0]},${H - PAD} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44">
        <path d={areaPath} fill="rgb(var(--brand-500) / 0.12)" />
        <path d={linePath} fill="none" stroke="rgb(var(--brand-500))" strokeWidth={2} />
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} fill="rgb(var(--brand-600))" />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-1">
        {rows.map((r, i) => <span key={i} className="truncate max-w-[80px]">{r.grupo ?? '—'}</span>)}
      </div>
    </div>
  );
}

function PieChart({ rows, hasTotal }: { rows: GroupRow[]; hasTotal: boolean }) {
  const values = rows.map(r => (hasTotal ? (r.total ?? 0) : r.registros));
  const sum = values.reduce((s, v) => s + v, 0) || 1;
  let acc = 0;
  const segments = values.map((v, i) => {
    const start = (acc / sum) * 360;
    acc += v;
    const end = (acc / sum) * 360;
    return `${PALETTE[i % PALETTE.length]} ${start}deg ${end}deg`;
  });

  return (
    <div className="flex items-center gap-6">
      <div
        className="w-36 h-36 rounded-full flex-none"
        style={{ background: `conic-gradient(${segments.join(', ')})` }}
      />
      <ul className="space-y-1.5 text-xs">
        {rows.map((r, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-none" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="text-slate-700 dark:text-slate-200">{r.grupo ?? '—'}</span>
            <span className="font-mono text-slate-400 dark:text-slate-500">{((values[i] / sum) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
