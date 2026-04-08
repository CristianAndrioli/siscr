import { useState, useEffect, useCallback } from 'react';
import { locaisService, type Local } from '../../services/estoqueService';

const TIPOS = [
  { value: 'GERAL', label: 'Geral', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  { value: 'ALMOXARIFADO', label: 'Almoxarifado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  { value: 'LOJA', label: 'Loja', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { value: 'ARMAZEM', label: 'Armazém', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { value: 'DEPOSITO', label: 'Depósito', color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  { value: 'EXTERNO', label: 'Externo', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
];

const tipoStyle = (tipo: string) => TIPOS.find(t => t.value === tipo)?.color ?? TIPOS[0].color;
const tipoLabel = (tipo: string) => TIPOS.find(t => t.value === tipo)?.label ?? tipo;

export function LocaisPage() {
  const [locais, setLocais] = useState<Local[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', tipo: 'GERAL', descricao: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setLocais(await locaisService.list());
    } catch {
      setError('Erro ao carregar locais.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm({ nome: '', tipo: 'GERAL', descricao: '' });
    setEditingId(null);
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (local: Local) => {
    setForm({ nome: local.nome, tipo: local.tipo, descricao: local.descricao ?? '' });
    setEditingId(local.id);
    setModalError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) { setModalError('Informe o nome do local.'); return; }
    setSaving(true);
    setModalError('');
    try {
      if (editingId) {
        await locaisService.update(editingId, { nome: form.nome, tipo: form.tipo, descricao: form.descricao || undefined });
      } else {
        await locaisService.create({ nome: form.nome, tipo: form.tipo, descricao: form.descricao || undefined });
      }
      setShowModal(false);
      load();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setModalError(e?.response?.data?.error || 'Erro ao salvar local.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await locaisService.delete(id);
      setDeleteConfirm(null);
      load();
    } catch {
      setError('Erro ao remover local. Verifique se não há movimentações vinculadas.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Locais de Estoque</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Cadastre os locais físicos de armazenamento</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Local
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-300 flex gap-2 items-start">
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span>O local <strong>GERAL</strong> é o padrão do sistema e não precisa ser cadastrado. Os locais cadastrados aqui aparecem como sugestões nos campos de movimentação e transferência.</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : locais.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum local cadastrado</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Clique em "Novo Local" para cadastrar depósitos, almoxarifados e lojas.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locais.map(local => (
            <div key={local.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col gap-2 hover:border-brand-300 dark:hover:border-brand-600 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {local.codigo && (
                      <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">#{local.codigo}</span>
                    )}
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-base truncate">{local.nome}</p>
                  </div>
                  {local.descricao && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{local.descricao}</p>}
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${tipoStyle(local.tipo)}`}>
                  {tipoLabel(local.tipo)}
                </span>
              </div>
              <div className="flex gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button onClick={() => openEdit(local)} className="flex-1 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  Editar
                </button>
                <button onClick={() => setDeleteConfirm(local.id)} className="px-3 py-1.5 text-xs font-medium border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors">
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Cadastro/Edição */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{editingId ? 'Editar Local' : 'Novo Local'}</h2>

            {modalError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome <span className="text-red-500">*</span></label>
                <input type="text" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value.toUpperCase() }))} placeholder="Ex: DEPOSITO-A, LOJA-CENTRO"
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Use nomes curtos em maiúsculas, sem espaços é recomendado.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS.map(t => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, tipo: t.value }))}
                      className={`py-2 px-2 rounded-lg border text-xs font-semibold transition-colors ${form.tipo === t.value ? t.color + ' border-transparent' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                <textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} rows={2} placeholder="Descrição ou endereço do local..."
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Confirmar remoção</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tem certeza que deseja remover este local? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocaisPage;
