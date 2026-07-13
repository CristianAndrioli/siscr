import { Link } from 'react-router-dom';
import { fmtBRL } from '../../utils/format';
import type { RecentItem } from '../../hooks/useUserPreferences';
import type { WidgetKey } from './widgetRegistry';
import { WIDGET_REGISTRY } from './widgetRegistry';

const fmtDate = (s?: string) => {
  if (!s) return '—';
  const [y, m, d] = s.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
};

export interface FinDash {
  receber: { pendente: number; vencido: number; qtd_vencido: number } | null;
  pagar: { pendente: number; vencido: number; qtd_vencido: number } | null;
  proximosVencimentosCR: { id: string; descricao: string; valor: number; vencimento: string; cliente: string }[];
  proximosVencimentosCP: { id: string; descricao: string; valor: number; vencimento: string; fornecedor: string }[];
  contas_bancarias: { id: string; nome: string; tipo: string; banco_nome?: string; saldo_atual: number }[];
  total_disponivel: number;
  faturamento_diario: { dia: string; total: number }[];
  faturamento_mes: { mes_atual: number | null; mes_anterior: number | null };
  estoque_critico: { produto_id: string; codigo: string; descricao: string; quantidade: number; estoque_minimo: number }[];
  os_abertas: { id: string; status: string; turno_data: string; maquina_nome?: string; obra_nome?: string }[];
}

const OS_STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente', execucao: 'Em execução', concluido: 'Concluído', cancelado: 'Cancelado',
};
const OS_STATUS_CLS: Record<string, string> = {
  pendente: 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300',
  execucao: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
  concluido: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  cancelado: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
};

const QUICK_ACTIONS = [
  { label: 'Nova cotação', to: '/faturamento/cotacoes' },
  { label: 'Emitir NF-e', to: '/faturamento/nf-venda' },
  { label: 'Lançar despesa', to: '/financeiro/contas-pagar' },
  { label: 'Receber título', to: '/financeiro/contas-receber' },
  { label: 'Novo cliente', to: '/cadastros/clientes' },
  { label: 'Abrir OS', to: '/frota/ordens-servico' },
];

function WidgetTitle({ title }: { title: string }) {
  return <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-2.5">{title}</p>;
}

function Kpi({ label, value, sub, subClass }: { label: string; value: string; sub?: string; subClass?: string }) {
  return (
    <div className="card p-4 h-full">
      <WidgetTitle title={label} />
      <p className="text-[25px] font-mono font-bold leading-none text-slate-900 dark:text-slate-100 tabular-nums">{value}</p>
      {sub && <p className={`text-xs mt-1.5 ${subClass ?? 'text-slate-400 dark:text-slate-500'}`}>{sub}</p>}
    </div>
  );
}

/** Renderiza o conteúdo de um widget pela chave — dados vêm do dashboard financeiro estendido. */
export function renderWidget(key: WidgetKey, dash: FinDash | null, loading: boolean, recentItems: RecentItem[]) {
  if (loading) return <div className="card h-full min-h-[96px] animate-pulse bg-slate-100 dark:bg-slate-800" />;

  switch (key) {
    case 'saldo': {
      const temContas = (dash?.contas_bancarias?.length ?? 0) > 0;
      const saldo = temContas ? (dash?.total_disponivel ?? 0) : (dash?.receber?.pendente ?? 0) - (dash?.pagar?.pendente ?? 0);
      return (
        <Kpi
          label={temContas ? 'Saldo em caixa' : 'Saldo previsto'}
          value={fmtBRL(saldo)}
          sub={temContas ? `${dash?.contas_bancarias.length} conta(s)` : 'Receber − Pagar'}
        />
      );
    }
    case 'receber':
      return (
        <Kpi
          label="A receber"
          value={fmtBRL(dash?.receber?.pendente)}
          sub={dash?.receber?.qtd_vencido ? `${dash.receber.qtd_vencido} vencido(s)` : 'Tudo em dia'}
          subClass={dash?.receber?.qtd_vencido ? 'text-negative font-semibold' : undefined}
        />
      );
    case 'pagar':
      return (
        <Kpi
          label="A pagar"
          value={fmtBRL(dash?.pagar?.pendente)}
          sub={dash?.pagar?.qtd_vencido ? `${dash.pagar.qtd_vencido} vencido(s)` : 'Tudo em dia'}
          subClass={dash?.pagar?.qtd_vencido ? 'text-negative font-semibold' : undefined}
        />
      );
    case 'vendas': {
      const atual = dash?.faturamento_mes?.mes_atual ?? 0;
      const anterior = dash?.faturamento_mes?.mes_anterior ?? 0;
      const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
      return (
        <Kpi
          label="Faturado no mês"
          value={fmtBRL(atual)}
          sub={variacao === null ? 'Sem dados do mês anterior' : `${variacao >= 0 ? '▲' : '▼'} ${Math.abs(variacao).toFixed(0)}% vs mês anterior`}
          subClass={variacao === null ? undefined : variacao >= 0 ? 'text-positive dark:text-positive-dark font-semibold' : 'text-negative font-semibold'}
        />
      );
    }
    case 'grafico': {
      const dias = dash?.faturamento_diario ?? [];
      const max = Math.max(1, ...dias.map(d => d.total || 0));
      const total = dias.reduce((s, d) => s + (d.total || 0), 0);
      return (
        <div className="card p-4 h-full">
          <div className="flex items-center justify-between mb-3">
            <WidgetTitle title={WIDGET_REGISTRY.grafico.title} />
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">{fmtBRL(total)}</span>
          </div>
          {dias.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-8 text-center">Nenhuma nota emitida neste mês.</p>
          ) : (
            <div className="flex items-end gap-1 h-24">
              {dias.map((d, i) => {
                const isLast = i === dias.length - 1;
                const h = Math.max(4, Math.round((d.total / max) * 96));
                return (
                  <div
                    key={d.dia}
                    className="flex-1 rounded-t transition-all"
                    style={{ height: `${h}px`, backgroundColor: isLast ? '#b7e549' : 'rgb(var(--brand-500))' }}
                    title={`${fmtDate(d.dia)}: ${fmtBRL(d.total)}`}
                  />
                );
              })}
            </div>
          )}
        </div>
      );
    }
    case 'vencimentos': {
      type Item = { id: string; descricao: string; valor: number; vencimento: string; quem: string; tipo: 'CR' | 'CP' };
      const items: Item[] = [
        ...(dash?.proximosVencimentosCR ?? []).map(i => ({ ...i, quem: i.cliente, tipo: 'CR' as const })),
        ...(dash?.proximosVencimentosCP ?? []).map(i => ({ ...i, quem: i.fornecedor, tipo: 'CP' as const })),
      ].sort((a, b) => a.vencimento.localeCompare(b.vencimento)).slice(0, 6);
      return (
        <div className="card p-4 h-full">
          <WidgetTitle title={WIDGET_REGISTRY.vencimentos.title} />
          {items.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">Nenhum vencimento nos próximos 7 dias.</p>
          ) : (
            <ul className="space-y-2">
              {items.map(item => (
                <li key={`${item.tipo}-${item.id}`} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-none ${item.tipo === 'CR' ? 'bg-positive dark:bg-positive-dark' : 'bg-negative'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{item.descricao}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{item.quem || '—'} · {fmtDate(item.vencimento)}</p>
                  </div>
                  <span className={`text-xs font-mono font-bold tabular-nums whitespace-nowrap ${item.tipo === 'CR' ? 'text-positive dark:text-positive-dark' : 'text-negative'}`}>
                    {item.tipo === 'CR' ? '+' : '−'}{fmtBRL(item.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    case 'atalhos':
      return (
        <div className="card p-4 h-full">
          <WidgetTitle title={WIDGET_REGISTRY.atalhos.title} />
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(a => (
              <Link
                key={a.to + a.label}
                to={a.to}
                className="flex items-center justify-center min-h-[44px] px-3 rounded-control border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300 text-center transition-colors"
              >
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      );
    case 'estoque': {
      const rows = dash?.estoque_critico ?? [];
      return (
        <div className="card p-4 h-full">
          <WidgetTitle title={WIDGET_REGISTRY.estoque.title} />
          {rows.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">Nenhum item abaixo do estoque mínimo.</p>
          ) : (
            <ul className="space-y-2.5">
              {rows.map(r => {
                const pct = r.estoque_minimo > 0 ? Math.min(100, Math.round((r.quantidade / r.estoque_minimo) * 100)) : 0;
                const barCls = pct < 25 ? 'bg-negative' : pct < 45 ? 'bg-warn' : 'bg-positive dark:bg-positive-dark';
                return (
                  <li key={r.produto_id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-700 dark:text-slate-200 truncate">{r.descricao}</span>
                      <span className="font-mono text-slate-400 dark:text-slate-500 flex-none ml-2">{r.quantidade}/{r.estoque_minimo}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className={`h-full rounded-full ${barCls}`} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    }
    case 'os': {
      const rows = dash?.os_abertas ?? [];
      return (
        <div className="card p-4 h-full">
          <WidgetTitle title={WIDGET_REGISTRY.os.title} />
          {rows.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-6 text-center">Nenhuma ordem de serviço em aberto.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map(os => (
                <li key={os.id} className="flex items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 flex-none">#{os.id.slice(0, 6)}</span>
                  <span className="text-xs text-slate-700 dark:text-slate-200 truncate flex-1">{os.maquina_nome || os.obra_nome || '—'}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-none ${OS_STATUS_CLS[os.status] ?? ''}`}>
                    {OS_STATUS_LABEL[os.status] ?? os.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }
    case 'recentes':
      return (
        <div className="card p-4 h-full">
          <WidgetTitle title={WIDGET_REGISTRY.recentes.title} />
          {recentItems.length === 0 ? (
            <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">Nenhum item acessado ainda.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {recentItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-400 font-medium hover:border-brand-300 dark:hover:border-brand-700 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    default:
      return null;
  }
}
