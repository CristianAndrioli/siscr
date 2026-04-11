import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { financeiroService, type DashboardData } from '../../services/financeiro';

const TIPO_ICON: Record<string, React.ReactElement> = {
  corrente: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
    </svg>
  ),
  poupanca: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  caixa: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  investimento: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
};

import { fmtBRL as fmt, fmtDate } from '../../utils/format';

function FinanceiroDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    financeiroService.dashboard()
      .then(setData)
      .catch(() => setError('Erro ao carregar dashboard financeiro.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
    );
  }

  const saldo = (data?.receber.pendente ?? 0) - (data?.pagar.pendente ?? 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Dashboard Financeiro</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Visão geral das suas finanças</p>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* A Receber */}
        <Link to="/financeiro/contas-receber" className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800 rounded-xl p-5 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">A Receber</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(data?.receber.pendente)}</p>
          {(data?.receber.qtd_vencido ?? 0) > 0 && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">
              {fmt(data?.receber.vencido)} vencido
            </p>
          )}
        </Link>

        {/* A Pagar */}
        <Link to="/financeiro/contas-pagar" className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-200 dark:hover:border-red-800 rounded-xl p-5 transition-all shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">A Pagar</span>
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
              <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{fmt(data?.pagar.pendente)}</p>
          {(data?.pagar.qtd_vencido ?? 0) > 0 && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">
              {fmt(data?.pagar.vencido)} vencido
            </p>
          )}
        </Link>

        {/* Saldo projetado */}
        <div className={`bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-sm ${saldo >= 0 ? 'border-slate-200 dark:border-slate-800' : 'border-red-200 dark:border-red-800'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Saldo Projetado</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${saldo >= 0 ? 'bg-brand-100 dark:bg-brand-950' : 'bg-red-100 dark:bg-red-950'}`}>
              <svg className={`w-4 h-4 ${saldo >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
          </div>
          <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(saldo)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">A receber − a pagar</p>
        </div>

        {/* Total recebido */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Total Recebido</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <svg className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
          </div>
          <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{fmt(data?.receber.recebido)}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Pago: {fmt(data?.pagar.pago)}</p>
        </div>
      </div>

      {/* Próximos vencimentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CR — próximos 7 dias */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recebimentos — próximos 7 dias</h2>
            <Link to="/financeiro/contas-receber" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Ver todos</Link>
          </div>
          {(data?.proximosVencimentosCR?.length ?? 0) === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">Nenhum vencimento nos próximos 7 dias.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.proximosVencimentosCR.map(item => (
                <li key={item.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.descricao}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{item.cliente || '—'} · {fmtDate(item.vencimento)}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 ml-4 flex-none">{fmt(item.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* CP — próximos 7 dias */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pagamentos — próximos 7 dias</h2>
            <Link to="/financeiro/contas-pagar" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">Ver todos</Link>
          </div>
          {(data?.proximosVencimentosCP?.length ?? 0) === 0 ? (
            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">Nenhum vencimento nos próximos 7 dias.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data?.proximosVencimentosCP.map(item => (
                <li key={item.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.descricao}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{item.fornecedor || '—'} · {fmtDate(item.vencimento)}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-600 dark:text-red-400 ml-4 flex-none">{fmt(item.valor)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Saldos bancários */}
      {(data?.contas_bancarias?.length ?? 0) > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Saldos por Conta</h2>
            <Link to="/financeiro/contas-bancarias" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
              Gerenciar contas
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {data?.contas_bancarias.map(cb => (
              <div key={cb.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                    {TIPO_ICON[cb.tipo] ?? TIPO_ICON.corrente}
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 truncate">{cb.nome}</p>
                </div>
                <p className={`text-lg font-bold ${(cb.saldo_atual ?? 0) >= 0 ? 'text-slate-800 dark:text-slate-100' : 'text-red-600 dark:text-red-400'}`}>
                  {fmt(cb.saldo_atual ?? 0)}
                </p>
                {cb.banco_nome && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{cb.banco_nome}</p>}
              </div>
            ))}
            {/* Card Total */}
            <div className="bg-brand-600 rounded-xl p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-xs font-semibold opacity-80">Total Disponível</p>
              </div>
              <p className="text-lg font-bold">{fmt(data?.total_disponivel ?? 0)}</p>
              <p className="text-xs opacity-70 mt-0.5">{data?.contas_bancarias.length} conta{(data?.contas_bancarias.length ?? 0) !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      )}

      {(data?.contas_bancarias?.length ?? 0) === 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-500 flex-none mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Nenhuma conta bancária cadastrada</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              Cadastre suas contas para ter controle real de fluxo de caixa.{' '}
              <Link to="/financeiro/contas-bancarias" className="underline font-medium">Cadastrar agora</Link>
            </p>
          </div>
        </div>
      )}

      {/* Ações rápidas */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/financeiro/contas-receber/novo"
          className="flex items-center gap-2 px-4 py-2 border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-sm font-medium rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Conta a Receber
        </Link>
        <Link
          to="/financeiro/contas-pagar/novo"
          className="flex items-center gap-2 px-4 py-2 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm font-medium rounded-lg hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Conta a Pagar
        </Link>
        <Link
          to="/financeiro/contas-bancarias"
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
          </svg>
          Contas Bancárias
        </Link>
      </div>
    </div>
  );
}

export default FinanceiroDashboard;
