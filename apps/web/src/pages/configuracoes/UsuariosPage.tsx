import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { authService } from '../../services/auth';
import { permissoesApi } from '../../services/permissoesApi';
import { usePermissions } from '../../hooks/usePermissions';
import { formatApiError } from '../../utils/helpers';

const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

type Role = 'admin' | 'manager' | 'user' | 'viewer';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador', manager: 'Gerente', user: 'Usuário', viewer: 'Visualizador',
};
const ROLE_STYLE: Record<Role, string> = {
  admin: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  manager: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  user: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  viewer: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

interface Usuario {
  id: string;
  email: string;
  nome: string;
  role: Role;
  ativo: number;
  created_at: string;
  custom_role_id?: string | null;
  custom_role_nome?: string | null;
}

type FormState = {
  email: string;
  nome: string;
  role: Role;
  senha: string;
  ativo: boolean;
  customRoleId: string;
};

const emptyForm = (): FormState => ({
  email: '',
  nome: '',
  role: 'user',
  senha: '',
  ativo: true,
  customRoleId: '',
});

export function UsuariosPage() {
  const { refresh: refreshPermissions } = usePermissions();
  const [perfis, setPerfis] = useState<{ id: string; nome: string }[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm());
  const currentUserId = authService.getLocalUser()?.id;

  useEffect(() => {
    permissoesApi
      .listPerfis()
      .then((r) => setPerfis((r.data.perfis ?? []).map((p) => ({ id: p.id, nome: p.nome }))))
      .catch(() => setPerfis([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/tenant/info/usuarios');
      setUsuarios(res.data.usuarios ?? []);
    } catch { setError('Erro ao carregar usuários.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm(emptyForm()); setEditingId(null); setModalError(''); setShowModal(true);
  };

  const openEdit = (u: Usuario) => {
    setForm({
      email: u.email,
      nome: u.nome,
      role: u.role,
      senha: '',
      ativo: u.ativo === 1,
      customRoleId: u.custom_role_id ?? '',
    });
    setEditingId(u.id); setModalError(''); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim() || !form.email.trim()) { setModalError('Nome e e-mail são obrigatórios.'); return; }
    if (!editingId && !form.senha.trim()) { setModalError('Informe uma senha para o novo usuário.'); return; }
    setSaving(true); setModalError('');
    try {
      if (editingId) {
        const customRoleId = form.role === 'admin' ? null : form.customRoleId || null;
        await api.put(`/tenant/info/usuarios/${editingId}`, {
          nome: form.nome,
          email: form.email,
          role: form.role,
          ativo: form.ativo,
          customRoleId,
        });
        if (editingId === currentUserId) await refreshPermissions();
      } else {
        await api.post('/tenant/info/usuarios', {
          nome: form.nome,
          email: form.email,
          role: form.role,
          senha: form.senha,
          ...(form.role !== 'admin' && form.customRoleId ? { customRoleId: form.customRoleId } : {}),
        });
      }
      setShowModal(false); load();
    } catch (err: unknown) {
      setModalError(formatApiError(err, 'Erro ao salvar.'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/tenant/info/usuarios/${id}`);
      setDeleteConfirm(null); load();
    } catch (err: unknown) {
      setError(formatApiError(err, 'Erro ao excluir.'));
    }
  };

  const filtered = usuarios.filter(u =>
    !busca || u.nome.toLowerCase().includes(busca.toLowerCase()) || u.email.toLowerCase().includes(busca.toLowerCase())
  );

  const ativos = usuarios.filter(u => u.ativo === 1).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Usuários</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gerencie quem tem acesso ao sistema</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Novo Usuário
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[['Total', usuarios.length], ['Ativos', ativos], ['Inativos', usuarios.length - ativos]].map(([label, val]) => (
          <div key={label as string} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label as string}</p>
            <p className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{val as number}</p>
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou e-mail..."
        className="w-full max-w-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">Nenhum usuário encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                {['Usuário', 'E-mail', 'Perfil', 'Permissão extra', 'Status', 'Desde', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 flex items-center justify-center text-xs font-bold flex-none">
                        {u.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{u.nome}</p>
                        {u.id === currentUserId && <span className="text-xs text-brand-500 font-medium">Você</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_STYLE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[140px] truncate" title={u.custom_role_nome ?? ''}>
                    {u.role === 'admin' ? '—' : u.custom_role_nome || 'Padrão do perfil'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${u.ativo === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {u.ativo === 1 ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(u)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">Editar</button>
                      {u.id !== currentUserId && (
                        <button onClick={() => setDeleteConfirm(u.id)} className="text-xs text-red-500 hover:underline font-medium">Excluir</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-md space-y-5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{editingId ? 'Editar Usuário' : 'Novo Usuário'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            {modalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{modalError}</div>}

            <div className="space-y-4">
              {[['Nome completo', 'nome', 'text', true], ['E-mail', 'email', 'email', true]].map(([label, field, type, req]) => (
                <div key={field as string}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label as string} {req && <span className="text-red-500">*</span>}</label>
                  <input type={type as string} value={(form as any)[field as string]} onChange={e => setForm(f => ({ ...f, [field as string]: e.target.value }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Perfil de acesso</label>
                <select
                  value={form.role}
                  onChange={(e) => {
                    const r = e.target.value as Role;
                    setForm((f) => ({
                      ...f,
                      role: r,
                      customRoleId: r === 'admin' ? '' : f.customRoleId,
                    }));
                  }}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {Object.entries(ROLE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  {form.role === 'admin'
                    ? 'Acesso total ao sistema (não combina com perfil personalizado)'
                    : form.role === 'manager'
                      ? 'Padrão: todos os módulos operacionais; use o item abaixo para restringir'
                      : form.role === 'user'
                        ? 'Padrão: módulos operacionais; use o item abaixo para restringir'
                        : 'Padrão: só leitura nos módulos operacionais; use o item abaixo para ajustar'}
                </p>
              </div>

              {form.role !== 'admin' && perfis.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Perfil personalizado (opcional)
                  </label>
                  <select
                    value={form.customRoleId}
                    onChange={(e) => setForm((f) => ({ ...f, customRoleId: e.target.value }))}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">Nenhum — usar permissões padrão do perfil acima</option>
                    {perfis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Quando definido, as permissões por módulo deste perfil substituem o padrão do Gerente/Usuário/Visualizador.
                  </p>
                </div>
              )}

              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Senha inicial <span className="text-red-500">*</span></label>
                  <input type="password" value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mínimo 6 caracteres"
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">O usuário poderá alterar a senha no perfil após o primeiro acesso.</p>
                </div>
              )}

              {editingId && (
                <div className="flex items-center gap-3 pt-1">
                  <button type="button" onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${form.ativo ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <label className="text-sm text-slate-700 dark:text-slate-300">{form.ativo ? 'Usuário ativo' : 'Usuário inativo'}</label>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">
                {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Excluir usuário?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">O usuário perderá acesso imediatamente. Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirm!)} className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsuariosPage;
