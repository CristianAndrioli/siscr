import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { bancarioService, ContaBancaria, ConciliacaoSessao } from '../../services/bancario';

// ─── Icons ────────────────────────────────────────────────────────

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const icons = {
  bank:    'M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z',
  upload:  'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5',
  link:    'M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244',
  arrow:   'M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18',
  check:   'M4.5 12.75l6 6 9-13.5',
  clock:   'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  docs:    'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  eye:     'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  plus:    'M12 4.5v15m7.5-7.5h-15',
  edit:    'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125',
  warning: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
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

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TIPO_LABEL: Record<string, string> = {
  corrente:    'Conta Corrente',
  poupanca:    'Poupança',
  caixa:       'Caixa',
  investimento:'Investimento',
};

// ─── Account header card ──────────────────────────────────────────

function AccountCard({ conta }: { conta: ContaBancaria }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-14 h-14 rounded-xl bg-brand-600 flex items-center justify-center flex-none shadow-sm">
        <Icon d={icons.bank} className="w-7 h-7 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 font-display">{conta.nome}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-sm text-slate-400 dark:text-slate-500">
          {conta.banco_nome && <span>{conta.banco_nome}</span>}
          {conta.agencia && <span>Ag. {conta.agencia}</span>}
          {conta.conta && <span>Cc. {conta.conta}</span>}
          <span>{TIPO_LABEL[conta.tipo] ?? conta.tipo}</span>
        </div>
      </div>
      <div className="text-right flex-none">
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(conta.saldo_atual)}</div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Saldo atual</div>
      </div>
    </div>
  );
}

// ─── Conciliation history row ─────────────────────────────────────

function ConciliacaoRow({ c }: { c: ConciliacaoSessao }) {
  const pct = c.total_itens > 0
    ? Math.round(((c.itens_conciliados + c.itens_ignorados + c.itens_manuais) / c.total_itens) * 100)
    : 100;

  const statusColor = c.status === 'finalizado' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400';

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
      <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 flex items-center justify-center flex-none">
        <Icon d={icons.docs} className="w-4 h-4 text-brand-600 dark:text-brand-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
          {c.arquivo_nome ?? 'Importação manual'}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
          {c.data_inicio && c.data_fim ? `${fmtDate(c.data_inicio)} → ${fmtDate(c.data_fim)} · ` : ''}
          {fmtDateTime(c.created_at)}
        </div>
        {/* progress bar */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500 flex-none">{pct}%</span>
        </div>
      </div>
      <div className="text-right flex-none space-y-1">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{c.itens_conciliados}</span>
          {' / '}
          <span className="text-amber-600 dark:text-amber-400 font-medium">{c.itens_manuais}</span>
          {' / '}
          <span className="text-slate-400 dark:text-slate-500">{c.itens_ignorados}</span>
          <span className="text-slate-300 dark:text-slate-600 ml-1 text-[10px]">V·M·I</span>
        </div>
        <div className={`text-xs font-semibold capitalize ${statusColor}`}>{c.status}</div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────

export function ContaBancariaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [conta, setConta] = useState<ContaBancaria | null>(null);
  const [historico, setHistorico] = useState<ConciliacaoSessao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const successConcId = searchParams.get('conciliacao');
  const ok = searchParams.get('ok');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      bancarioService.getConta(id),
      bancarioService.listConciliacoes(id),
    ]).then(([c, hist]) => {
      setConta(c);
      setHistorico(hist);
    }).catch(() => {
      setError('Não foi possível carregar os dados da conta.');
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <svg className="w-8 h-8 animate-spin text-brand-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </Layout>
    );
  }

  if (error || !conta) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto text-center py-16">
          <p className="text-slate-500 dark:text-slate-400">{error ?? 'Conta não encontrada.'}</p>
          <button onClick={() => navigate('/financeiro/contas-bancarias')} className="mt-4 text-sm text-brand-600 dark:text-brand-400 hover:underline">
            ← Voltar para contas bancárias
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
          <button onClick={() => navigate('/financeiro/contas-bancarias')} className="hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
            Contas Bancárias
          </button>
          <span>/</span>
          <span className="text-slate-600 dark:text-slate-300 font-medium">{conta.nome}</span>
        </div>

        {/* Success toast */}
        {ok && successConcId && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm">
            <div className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center flex-none">
              <Icon d={icons.check} className="w-3 h-3 text-white" />
            </div>
            Conciliação finalizada com sucesso! Os vínculos foram registrados.
          </div>
        )}

        {/* Account card */}
        <AccountCard conta={conta} />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3">
          <Link
            to={`/financeiro/conciliacao/nova?contaId=${conta.id}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <Icon d={icons.upload} className="w-4 h-4" />
            Nova Conciliação (OFX)
          </Link>
          <button
            disabled
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 text-sm font-medium cursor-not-allowed opacity-60"
            title="Em desenvolvimento"
          >
            <Icon d={icons.link} className="w-4 h-4" />
            Integração bancária
            <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
              EM BREVE
            </span>
          </button>
        </div>

        {/* Conciliation history */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Icon d={icons.clock} className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Histórico de conciliações</h3>
            </div>
            {historico.length > 0 && (
              <span className="text-xs text-slate-400 dark:text-slate-500">{historico.length} importação{historico.length > 1 ? 'ões' : ''}</span>
            )}
          </div>

          {historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Icon d={icons.docs} className="w-6 h-6 text-slate-300 dark:text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Nenhuma conciliação realizada</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Importe um arquivo OFX para iniciar.</p>
              </div>
              <Link
                to={`/financeiro/conciliacao/nova?contaId=${conta.id}`}
                className="mt-1 text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium"
              >
                Fazer primeira conciliação →
              </Link>
            </div>
          ) : (
            <div>
              {historico.map(c => <ConciliacaoRow key={c.id} c={c} />)}
            </div>
          )}
        </div>

        {/* Legend */}
        {historico.length > 0 && (
          <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-4">
            <span><span className="font-semibold text-emerald-600 dark:text-emerald-400">V</span> = Vinculados</span>
            <span><span className="font-semibold text-amber-600 dark:text-amber-400">M</span> = Manuais</span>
            <span><span className="font-semibold">I</span> = Ignorados</span>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ContaBancariaDetailPage;
