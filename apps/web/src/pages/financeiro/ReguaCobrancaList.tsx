import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  reguaCobrancaService,
  type ReguaCobrancaListItem,
  type ReguaPerfil,
} from '../../services/financeiro';

const PERFIL_LABEL: Record<ReguaPerfil, string> = {
  geral: 'Geral',
  novo_cliente: 'Novo cliente',
  bom_pagador: 'Bom pagador',
  pagador_duvidoso: 'Pagador duvidoso',
  mau_pagador: 'Mau pagador',
};

export default function ReguaCobrancaList() {
  const [reguas, setReguas] = useState<ReguaCobrancaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reguaCobrancaService
      .list()
      .then((r) => setReguas(r.reguas ?? []))
      .catch(() => setError('Não foi possível carregar as réguas.'))
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

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Régua de cobrança</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Defina lembretes por perfil (e-mail, SMS, WhatsApp). O disparo automático pode ser ligado em versões futuras.
          </p>
        </div>
        <Link
          to="/financeiro/regua-cobranca/nova"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-colors flex-none"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova régua
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {reguas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center">
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">Nenhuma régua cadastrada.</p>
          <Link
            to="/financeiro/regua-cobranca/nova"
            className="text-brand-600 dark:text-brand-400 font-medium text-sm hover:underline"
          >
            Criar primeira régua
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50">
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Nome</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Perfil</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Etapas</th>
                  <th className="text-center py-3 px-4 font-semibold text-slate-600 dark:text-slate-400">Status</th>
                  <th className="text-right py-3 px-4 font-semibold text-slate-600 dark:text-slate-400"> </th>
                </tr>
              </thead>
              <tbody>
                {reguas.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800 dark:text-slate-100">{r.nome}</div>
                      {r.eh_padrao === 1 && (
                        <span className="inline-block mt-1 text-[10px] uppercase tracking-wide font-semibold text-brand-600 dark:text-brand-400">
                          Padrão do tenant
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      {PERFIL_LABEL[r.perfil] ?? r.perfil}
                    </td>
                    <td className="py-3 px-4 text-center tabular-nums text-slate-600 dark:text-slate-400">
                      {Number(r.etapa_count ?? 0)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {r.ativo === 1 ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Ativa
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          Inativa
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={`/financeiro/regua-cobranca/${r.id}`}
                        className="text-brand-600 dark:text-brand-400 font-medium hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
