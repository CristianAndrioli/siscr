import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { formatApiError } from '../../utils/helpers';
import {
  certValidityHint,
  fmtDate,
  normalizeEmpresaRow,
  normalizeFilialRow,
  parseA1CertMeta,
  type Empresa,
  type Filial,
} from './filiaisFormShared';

export function FiliaisPage() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedEmpresa, setExpandedEmpresa] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ tipo: 'empresa' | 'filial'; id: string } | null>(
    null,
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [eRes, fRes] = await Promise.all([
        api.get('/tenant/info/empresas?include_inactive=1'),
        api.get('/tenant/info/filiais?include_inactive=1'),
      ]);
      setEmpresas((eRes.data.empresas ?? []).map(normalizeEmpresaRow));
      setFiliais((fRes.data.filiais ?? []).map(normalizeFilialRow));
    } catch {
      setError('Erro ao carregar dados.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.tipo === 'empresa') {
        await api.delete(`/tenant/info/empresas/${deleteTarget.id}`);
      } else {
        await api.delete(`/tenant/info/filiais/${deleteTarget.id}`);
      }
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      setError(formatApiError(err, 'Erro ao excluir.'));
      setDeleteTarget(null);
    }
  };

  const filiaisDaEmpresa = (id: string) => filiais.filter((f) => f.empresa_id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
            Empresas e Filiais
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {empresas.length} empresa(s) · {filiais.length} filial(is)
          </p>
        </div>
        <button
          onClick={() => navigate('/configuracoes/filiais/empresas/novo')}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nova Empresa
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      ) : empresas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-16 text-center">
          <svg
            className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
            />
          </svg>
          <p className="text-slate-400 dark:text-slate-500 mb-4 text-sm">Nenhuma empresa cadastrada</p>
          <button
            onClick={() => navigate('/configuracoes/filiais/empresas/novo')}
            className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700"
          >
            Cadastrar primeira empresa
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {empresas.map((empresa) => {
            const filiaisE = filiaisDaEmpresa(empresa.id);
            const expanded = expandedEmpresa === empresa.id;
            const empresaCertMeta = parseA1CertMeta(empresa.a1_cert_meta);
            return (
              <div
                key={empresa.id}
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden ${
                  empresa.ativo === 0 ? 'opacity-75' : ''
                }`}
              >
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  onClick={() => setExpandedEmpresa(expanded ? null : empresa.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 flex items-center justify-center flex-none">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.75}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 min-w-0">
                        <span className="truncate">{empresa.razao_social}</span>
                        {empresa.ativo === 0 && (
                          <span className="flex-none text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-semibold">
                            Desativada
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-2">
                        <span>
                          {empresa.nome_fantasia || empresa.cnpj || 'CNPJ não informado'} ·{' '}
                          {filiaisE.length} filial(is)
                        </span>
                        {empresa.a1_cert_uploaded_at && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                            A1 matriz
                          </span>
                        )}
                        {empresaCertMeta &&
                          (() => {
                            const h = certValidityHint(empresaCertMeta.validTo);
                            return (
                              <span
                                className={`text-[10px] ${h.expired ? 'text-red-600 dark:text-red-400' : h.soon ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}
                              >
                                {h.expired || h.soon ? h.text : `até ${fmtDate(empresaCertMeta.validTo)}`}
                              </span>
                            );
                          })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/configuracoes/filiais/empresas/${empresa.id}`);
                      }}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium px-2 py-1"
                    >
                      Editar
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ tipo: 'empresa', id: empresa.id });
                      }}
                      className="text-xs text-red-500 hover:underline font-medium px-2 py-1"
                    >
                      Excluir
                    </button>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    {(empresa.cidade || empresa.uf || empresa.email) && (
                      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-4">
                        {empresa.cidade && (
                          <span>
                            {empresa.cidade}
                            {empresa.uf ? ` / ${empresa.uf}` : ''}
                          </span>
                        )}
                        {empresa.email && <span>{empresa.email}</span>}
                        {empresa.telefone && <span>{empresa.telefone}</span>}
                        <span>Cadastrada em {fmtDate(empresa.created_at)}</span>
                      </div>
                    )}

                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                          Filiais ({filiaisE.length})
                        </p>
                        {empresa.ativo !== 0 && (
                        <button
                          onClick={() =>
                            navigate(`/configuracoes/filiais/filiais/novo?empresaId=${empresa.id}`)
                          }
                          className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          Nova Filial
                        </button>
                        )}
                      </div>
                      {filiaisE.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                          Nenhuma filial cadastrada para esta empresa.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {filiaisE.map((filial) => {
                            const filialCertMeta = parseA1CertMeta(filial.a1_cert_meta);
                            return (
                              <div
                                key={filial.id}
                                className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-4 py-2.5"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div
                                    className={`w-2 h-2 rounded-full flex-none ${filial.ativa === 1 ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`}
                                  />
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                                      {filial.nome}
                                    </p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-2">
                                      <span>
                                        {filial.cidade && filial.uf
                                          ? `${filial.cidade}/${filial.uf}`
                                          : filial.cnpj || '—'}
                                      </span>
                                      {filial.a1_cert_uploaded_at && (
                                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-semibold">
                                          A1 filial
                                        </span>
                                      )}
                                      {filialCertMeta &&
                                        (() => {
                                          const h = certValidityHint(filialCertMeta.validTo);
                                          return (
                                            <span
                                              className={`text-[10px] ${h.expired ? 'text-red-600 dark:text-red-400' : h.soon ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}
                                            >
                                              {h.expired || h.soon
                                                ? h.text
                                                : `até ${fmtDate(filialCertMeta.validTo)}`}
                                            </span>
                                          );
                                        })()}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4 flex-none">
                                  <span
                                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${filial.ativa === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                                  >
                                    {filial.ativa === 1 ? 'Ativa' : 'Inativa'}
                                  </span>
                                  <button
                                    onClick={() =>
                                      navigate(`/configuracoes/filiais/filiais/${filial.id}`)
                                    }
                                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => setDeleteTarget({ tipo: 'filial', id: filial.id })}
                                    className="text-xs text-red-500 hover:underline font-medium"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Excluir {deleteTarget.tipo === 'empresa' ? 'empresa' : 'filial'}?
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {deleteTarget.tipo === 'empresa'
                ? 'Todas as filiais vinculadas também serão removidas. '
                : ''}
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FiliaisPage;
