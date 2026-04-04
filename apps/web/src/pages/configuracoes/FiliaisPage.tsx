import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

interface Empresa {
  id: string; razao_social: string; nome_fantasia?: string; cnpj?: string;
  cidade?: string; uf?: string; email?: string; telefone?: string;
  logradouro?: string; numero?: string; bairro?: string; cep?: string;
  total_filiais?: number; created_at: string;
}
interface Filial {
  id: string; nome: string; cnpj?: string; uf?: string; cidade?: string;
  logradouro?: string; numero?: string; bairro?: string; cep?: string;
  ativa: number; empresa_id: string; empresa_nome?: string; created_at?: string;
}

type EmpresaForm = { razaoSocial: string; nomeFantasia: string; cnpj: string; email: string; telefone: string; uf: string; cidade: string; logradouro: string; numero: string; bairro: string; cep: string; };
type FilialForm = { nome: string; cnpj: string; uf: string; cidade: string; logradouro: string; numero: string; bairro: string; cep: string; ativa: boolean; };

const emptyEmpresa = (): EmpresaForm => ({ razaoSocial: '', nomeFantasia: '', cnpj: '', email: '', telefone: '', uf: 'SC', cidade: '', logradouro: '', numero: '', bairro: '', cep: '' });
const emptyFilial = (): FilialForm => ({ nome: '', cnpj: '', uf: 'SC', cidade: '', logradouro: '', numero: '', bairro: '', cep: '', ativa: true });

function Field({ label, value, onChange, type = 'text', required, placeholder, maxLen }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; maxLen?: number; }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLen}
        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[]; }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function FiliaisPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedEmpresa, setExpandedEmpresa] = useState<string | null>(null);

  // Modal empresa
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [empresaEditing, setEmpresaEditing] = useState<string | null>(null);
  const [empresaForm, setEmpresaForm] = useState(emptyEmpresa());
  const [empresaSaving, setEmpresaSaving] = useState(false);
  const [empresaModalError, setEmpresaModalError] = useState('');

  // Modal filial
  const [showFilialModal, setShowFilialModal] = useState(false);
  const [filialEditing, setFilialEditing] = useState<string | null>(null);
  const [filialParentId, setFilialParentId] = useState<string | null>(null);
  const [filialForm, setFilialForm] = useState(emptyFilial());
  const [filialSaving, setFilialSaving] = useState(false);
  const [filialModalError, setFilialModalError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<{ tipo: 'empresa' | 'filial'; id: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [eRes, fRes] = await Promise.all([
        api.get('/tenant/info/empresas'),
        api.get('/tenant/info/filiais'),
      ]);
      setEmpresas(eRes.data.empresas ?? []);
      setFiliais(fRes.data.filiais ?? []);
    } catch { setError('Erro ao carregar dados.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Empresa ────────────────────────────────────────────

  const openNewEmpresa = () => {
    setEmpresaForm(emptyEmpresa()); setEmpresaEditing(null); setEmpresaModalError(''); setShowEmpresaModal(true);
  };

  const openEditEmpresa = (e: Empresa) => {
    setEmpresaForm({
      razaoSocial: e.razao_social, nomeFantasia: e.nome_fantasia ?? '', cnpj: e.cnpj ?? '',
      email: e.email ?? '', telefone: e.telefone ?? '', uf: e.uf ?? 'SC', cidade: e.cidade ?? '',
      logradouro: e.logradouro ?? '', numero: e.numero ?? '', bairro: e.bairro ?? '', cep: e.cep ?? '',
    });
    setEmpresaEditing(e.id); setEmpresaModalError(''); setShowEmpresaModal(true);
  };

  const setEF = (k: keyof EmpresaForm, v: string) => setEmpresaForm(f => ({ ...f, [k]: v }));

  const saveEmpresa = async () => {
    if (!empresaForm.razaoSocial.trim()) { setEmpresaModalError('Razão social é obrigatória.'); return; }
    if (!empresaForm.cnpj.trim() || empresaForm.cnpj.length !== 14) { setEmpresaModalError('CNPJ inválido (somente números, 14 dígitos).'); return; }
    setEmpresaSaving(true); setEmpresaModalError('');
    try {
      const payload = { ...empresaForm };
      if (empresaEditing) {
        await api.put(`/tenant/info/empresas/${empresaEditing}`, payload);
      } else {
        await api.post('/tenant/info/empresas', payload);
      }
      setShowEmpresaModal(false); load();
    } catch (err: any) {
      setEmpresaModalError(err?.response?.data?.error || 'Erro ao salvar empresa.');
    } finally { setEmpresaSaving(false); }
  };

  // ── Filial ──────────────────────────────────────────────

  const openNewFilial = (empresaId: string) => {
    setFilialForm(emptyFilial()); setFilialEditing(null); setFilialParentId(empresaId); setFilialModalError(''); setShowFilialModal(true);
  };

  const openEditFilial = (f: Filial) => {
    setFilialForm({ nome: f.nome, cnpj: f.cnpj ?? '', uf: f.uf ?? 'SC', cidade: f.cidade ?? '',
      logradouro: f.logradouro ?? '', numero: f.numero ?? '', bairro: f.bairro ?? '', cep: f.cep ?? '', ativa: f.ativa === 1 });
    setFilialEditing(f.id); setFilialParentId(f.empresa_id); setFilialModalError(''); setShowFilialModal(true);
  };

  const setFF = (k: keyof FilialForm, v: string | boolean) => setFilialForm(f => ({ ...f, [k]: v }));

  const saveFilial = async () => {
    if (!filialForm.nome.trim()) { setFilialModalError('Nome da filial é obrigatório.'); return; }
    setFilialSaving(true); setFilialModalError('');
    try {
      const payload = { ...filialForm, ativa: filialForm.ativa };
      if (filialEditing) {
        await api.put(`/tenant/info/filiais/${filialEditing}`, payload);
      } else {
        await api.post(`/tenant/info/empresas/${filialParentId}/filiais`, payload);
      }
      setShowFilialModal(false); load();
    } catch (err: any) {
      setFilialModalError(err?.response?.data?.error || 'Erro ao salvar filial.');
    } finally { setFilialSaving(false); }
  };

  // ── Delete ──────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.tipo === 'empresa') {
        await api.delete(`/tenant/info/empresas/${deleteTarget.id}`);
      } else {
        await api.delete(`/tenant/info/filiais/${deleteTarget.id}`);
      }
      setDeleteTarget(null); load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao excluir.'); setDeleteTarget(null);
    }
  };

  const filiaisDaEmpresa = (id: string) => filiais.filter(f => f.empresa_id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Empresas e Filiais</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{empresas.length} empresa(s) · {filiais.length} filial(is)</p>
        </div>
        <button onClick={openNewEmpresa} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nova Empresa
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : empresas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-16 text-center">
          <svg className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
          <p className="text-slate-400 dark:text-slate-500 mb-4 text-sm">Nenhuma empresa cadastrada</p>
          <button onClick={openNewEmpresa} className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700">Cadastrar primeira empresa</button>
        </div>
      ) : (
        <div className="space-y-3">
          {empresas.map(empresa => {
            const filiaisE = filiaisDaEmpresa(empresa.id);
            const expanded = expandedEmpresa === empresa.id;
            return (
              <div key={empresa.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => setExpandedEmpresa(expanded ? null : empresa.id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 flex items-center justify-center flex-none">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{empresa.razao_social}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{empresa.nome_fantasia || empresa.cnpj || 'CNPJ não informado'} · {filiaisE.length} filial(is)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={e => { e.stopPropagation(); openEditEmpresa(empresa); }} className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium px-2 py-1">Editar</button>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget({ tipo: 'empresa', id: empresa.id }); }} className="text-xs text-red-500 hover:underline font-medium px-2 py-1">Excluir</button>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    {/* Detalhes da empresa */}
                    {(empresa.cidade || empresa.uf || empresa.email) && (
                      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-4">
                        {empresa.cidade && <span>{empresa.cidade}{empresa.uf ? ` / ${empresa.uf}` : ''}</span>}
                        {empresa.email && <span>{empresa.email}</span>}
                        {empresa.telefone && <span>{empresa.telefone}</span>}
                        <span>Cadastrada em {fmtDate(empresa.created_at)}</span>
                      </div>
                    )}

                    {/* Filiais */}
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Filiais ({filiaisE.length})</p>
                        <button onClick={() => openNewFilial(empresa.id)} className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                          Nova Filial
                        </button>
                      </div>
                      {filiaisE.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic">Nenhuma filial cadastrada para esta empresa.</p>
                      ) : (
                        <div className="space-y-2">
                          {filiaisE.map(filial => (
                            <div key={filial.id} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-4 py-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-2 h-2 rounded-full flex-none ${filial.ativa === 1 ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{filial.nome}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500">{filial.cidade && filial.uf ? `${filial.cidade}/${filial.uf}` : filial.cnpj || '—'}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4 flex-none">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${filial.ativa === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{filial.ativa === 1 ? 'Ativa' : 'Inativa'}</span>
                                <button onClick={() => openEditFilial(filial)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">Editar</button>
                                <button onClick={() => setDeleteTarget({ tipo: 'filial', id: filial.id })} className="text-xs text-red-500 hover:underline font-medium">Excluir</button>
                              </div>
                            </div>
                          ))}
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

      {/* Modal Empresa */}
      {showEmpresaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{empresaEditing ? 'Editar Empresa' : 'Nova Empresa'}</h2>
              <button onClick={() => setShowEmpresaModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-5">
              {empresaModalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{empresaModalError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Field label="Razão Social" value={empresaForm.razaoSocial} onChange={v => setEF('razaoSocial', v)} required /></div>
                <Field label="Nome Fantasia" value={empresaForm.nomeFantasia} onChange={v => setEF('nomeFantasia', v)} />
                <Field label="CNPJ (somente números)" value={empresaForm.cnpj} onChange={v => setEF('cnpj', v.replace(/\D/g, ''))} required maxLen={14} />
                <Field label="E-mail" value={empresaForm.email} onChange={v => setEF('email', v)} type="email" />
                <Field label="Telefone" value={empresaForm.telefone} onChange={v => setEF('telefone', v)} />
                <div className="col-span-2"><Field label="Logradouro" value={empresaForm.logradouro} onChange={v => setEF('logradouro', v)} /></div>
                <Field label="Número" value={empresaForm.numero} onChange={v => setEF('numero', v)} />
                <Field label="Bairro" value={empresaForm.bairro} onChange={v => setEF('bairro', v)} />
                <Field label="Cidade" value={empresaForm.cidade} onChange={v => setEF('cidade', v)} />
                <SelectField label="UF" value={empresaForm.uf} onChange={v => setEF('uf', v)} options={UF_LIST} />
                <Field label="CEP" value={empresaForm.cep} onChange={v => setEF('cep', v.replace(/\D/g, ''))} maxLen={8} />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowEmpresaModal(false)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                <button onClick={saveEmpresa} disabled={empresaSaving} className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">{empresaSaving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Filial */}
      {showFilialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{filialEditing ? 'Editar Filial' : 'Nova Filial'}</h2>
              <button onClick={() => setShowFilialModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-5">
              {filialModalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{filialModalError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Field label="Nome da Filial" value={filialForm.nome} onChange={v => setFF('nome', v)} required /></div>
                <Field label="CNPJ (somente números)" value={filialForm.cnpj} onChange={v => setFF('cnpj', v.replace(/\D/g, ''))} maxLen={14} />
                <Field label="Cidade" value={filialForm.cidade} onChange={v => setFF('cidade', v)} />
                <SelectField label="UF" value={filialForm.uf} onChange={v => setFF('uf', v)} options={UF_LIST} />
                <Field label="CEP" value={filialForm.cep} onChange={v => setFF('cep', v.replace(/\D/g, ''))} maxLen={8} />
                <div className="col-span-2"><Field label="Logradouro" value={filialForm.logradouro} onChange={v => setFF('logradouro', v)} /></div>
                <Field label="Número" value={filialForm.numero} onChange={v => setFF('numero', v)} />
                <Field label="Bairro" value={filialForm.bairro} onChange={v => setFF('bairro', v)} />
              </div>
              {filialEditing && (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setFF('ativa', !filialForm.ativa)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${filialForm.ativa ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${filialForm.ativa ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <label className="text-sm text-slate-700 dark:text-slate-300">{filialForm.ativa ? 'Filial ativa' : 'Filial inativa'}</label>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowFilialModal(false)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                <button onClick={saveFilial} disabled={filialSaving} className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">{filialSaving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Excluir {deleteTarget.tipo === 'empresa' ? 'empresa' : 'filial'}?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {deleteTarget.tipo === 'empresa' ? 'Todas as filiais vinculadas também serão removidas. ' : ''}Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FiliaisPage;
