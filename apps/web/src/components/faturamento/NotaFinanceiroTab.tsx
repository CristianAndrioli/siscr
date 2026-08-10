import { Link } from 'react-router-dom';
import { fmtBRL, fmtDate } from '../../utils/format';

export type NotaFinanceiroConta = {
  id: string;
  codigo?: number | null;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
  parcela?: number | null;
  total_parcelas?: number | null;
  valor_pago?: number | null;
  data_pagamento?: string | null;
  categoria?: string | null;
  cliente?: string | null;
};

export type NotaFinanceiroLancamento = {
  id: string;
  numero?: number | null;
  data_lancamento: string;
  historico: string;
  origem_tipo?: string | null;
  status: string;
};

const CR_STATUS: Record<string, { label: string; className: string }> = {
  pendente: {
    label: 'Pendente',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
  parcialmente_pago: {
    label: 'Parcial',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  },
  pago: {
    label: 'Pago',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  cancelado: {
    label: 'Cancelado',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
};

type Props = {
  loading: boolean;
  contasReceber: NotaFinanceiroConta[];
  lancamentos: NotaFinanceiroLancamento[];
  onRefresh: () => void;
  emptyHint?: string;
};

export function NotaFinanceiroTab({
  loading,
  contasReceber,
  lancamentos,
  onRefresh,
  emptyHint = 'Nenhum lançamento financeiro ainda. Use Faturar no ERP após a autorização.',
}: Props) {
  const totalCr = contasReceber.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalPago = contasReceber.reduce((s, c) => s + Number(c.valor_pago || 0), 0);
  const count = contasReceber.length + lancamentos.length;

  if (loading && count === 0) {
    return <p className="text-sm text-slate-500 py-8 text-center">Carregando financeiro…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Lançamentos vinculados a esta nota ({count}).
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
        >
          {loading ? 'Atualizando…' : 'Atualizar'}
        </button>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Contas a receber
          </h3>
          {contasReceber.length > 0 && (
            <p className="text-xs text-slate-500">
              Total {fmtBRL(totalCr)}
              {totalPago > 0 ? ` · recebido ${fmtBRL(totalPago)}` : ''}
            </p>
          )}
        </div>

        {contasReceber.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            {emptyHint}
          </p>
        ) : (
          <ul className="space-y-2">
            {contasReceber.map((cr) => {
              const st = CR_STATUS[cr.status] ?? CR_STATUS.pendente;
              const parc =
                cr.total_parcelas && cr.total_parcelas > 1
                  ? `${cr.parcela ?? '?'}/${cr.total_parcelas}`
                  : null;
              return (
                <li key={cr.id}>
                  <Link
                    to={`/financeiro/contas-receber/${cr.id}`}
                    className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                          {cr.codigo != null ? `#${cr.codigo} · ` : ''}
                          {cr.descricao}
                        </p>
                        <p className="text-xs text-slate-500">
                          Venc. {fmtDate(cr.vencimento)}
                          {parc ? ` · Parcela ${parc}` : ''}
                          {cr.cliente ? ` · ${cr.cliente}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <p className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                          {fmtBRL(cr.valor)}
                        </p>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.className}`}
                        >
                          {st.label}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Lançamentos contábeis
        </h3>
        {lancamentos.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            Nenhum lançamento contábil automático para esta nota.
          </p>
        ) : (
          <ul className="space-y-2">
            {lancamentos.map((lc) => (
              <li
                key={lc.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {lc.numero != null ? `LC ${lc.numero}` : 'Lançamento'}
                      {lc.origem_tipo ? ` · ${lc.origem_tipo}` : ''}
                    </p>
                    <p className="text-xs text-slate-500">{lc.historico}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="text-xs text-slate-500">{fmtDate(lc.data_lancamento)}</p>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {lc.status}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
