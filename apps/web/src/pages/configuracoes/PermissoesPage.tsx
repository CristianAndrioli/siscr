import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

type Role = 'admin' | 'manager' | 'user' | 'viewer';

const ROLES: { role: Role; label: string; description: string; color: string }[] = [
  { role: 'admin', label: 'Administrador', description: 'Acesso completo ao sistema, incluindo configurações, usuários e todas as funcionalidades.', color: 'violet' },
  { role: 'manager', label: 'Gerente', description: 'Acesso a todos os módulos operacionais (Financeiro, Estoque, Faturamento, Cadastros). Não pode acessar configurações do sistema.', color: 'blue' },
  { role: 'user', label: 'Usuário', description: 'Acesso aos módulos operacionais com permissão de criar e editar registros. Sem acesso a exclusão ou relatórios avançados.', color: 'slate' },
  { role: 'viewer', label: 'Visualizador', description: 'Somente leitura. Pode visualizar todos os registros mas não pode criar, editar ou excluir.', color: 'slate' },
];

const MODULOS = [
  { id: 'cadastros', label: 'Cadastros', desc: 'Pessoas, Produtos, Serviços' },
  { id: 'financeiro', label: 'Financeiro', desc: 'Contas a pagar, contas a receber, dashboard' },
  { id: 'faturamento', label: 'Faturamento', desc: 'Cotações, NF-e, NFS-e' },
  { id: 'estoque', label: 'Estoque', desc: 'Posição, movimentações, transferências, locais' },
  { id: 'configuracoes', label: 'Configurações', desc: 'Usuários, empresas, filiais, permissões' },
];

const PERM_MAP: Record<Role, Record<string, { ver: boolean; editar: boolean }>> = {
  admin: Object.fromEntries(MODULOS.map(m => [m.id, { ver: true, editar: true }])),
  manager: {
    cadastros: { ver: true, editar: true },
    financeiro: { ver: true, editar: true },
    faturamento: { ver: true, editar: true },
    estoque: { ver: true, editar: true },
    configuracoes: { ver: false, editar: false },
  },
  user: {
    cadastros: { ver: true, editar: true },
    financeiro: { ver: true, editar: true },
    faturamento: { ver: true, editar: true },
    estoque: { ver: true, editar: true },
    configuracoes: { ver: false, editar: false },
  },
  viewer: Object.fromEntries(MODULOS.map(m => [m.id, { ver: true, editar: false }])),
};

const COLOR = {
  violet: { badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300', ring: 'ring-violet-300 dark:ring-violet-700', header: 'bg-violet-50 dark:bg-violet-950/30' },
  blue: { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300', ring: 'ring-blue-300 dark:ring-blue-700', header: 'bg-blue-50 dark:bg-blue-950/30' },
  slate: { badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', ring: 'ring-slate-200 dark:ring-slate-700', header: 'bg-slate-50 dark:bg-slate-800/50' },
};

interface Usuario { id: string; email: string; nome: string; role: Role; ativo: number; }

export function PermissoesPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUsers, setShowUsers] = useState<Role | null>(null);
  const [changingRole, setChangingRole] = useState<{ userId: string; newRole: Role } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tenant/info/usuarios');
      setUsuarios(res.data.usuarios ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const usersWithRole = (role: Role) => usuarios.filter(u => u.role === role);

  const applyRoleChange = async () => {
    if (!changingRole) return;
    setSaving(true);
    try {
      await api.put(`/tenant/info/usuarios/${changingRole.userId}`, { role: changingRole.newRole });
      setMsg({ type: 'success', text: 'Perfil atualizado com sucesso.' });
      setChangingRole(null);
      load();
    } catch {
      setMsg({ type: 'error', text: 'Erro ao atualizar perfil.' });
    } finally { setSaving(false); }
  };

  useEffect(() => {
    if (msg) { const t = setTimeout(() => setMsg(null), 3500); return () => clearTimeout(t); }
  }, [msg]);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Permissões</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Perfis de acesso e o que cada um pode fazer no sistema</p>
      </div>

      {msg && (
        <div className={`px-4 py-3 rounded-lg text-sm border ${msg.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'}`}>
          {msg.text}
        </div>
      )}

      <div className="space-y-4">
        {ROLES.map(({ role, label, description, color }) => {
          const c = COLOR[color as keyof typeof COLOR];
          const roleUsers = usersWithRole(role);
          const isOpen = showUsers === role;
          const perms = PERM_MAP[role];

          return (
            <div key={role} className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden ring-1 ${c.ring}`}>
              <div className={`px-5 py-4 ${c.header}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${c.badge}`}>{label}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {loading ? '...' : `${roleUsers.length} usuário(s)`}
                    </span>
                  </div>
                  {roleUsers.length > 0 && (
                    <button onClick={() => setShowUsers(isOpen ? null : role)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                      {isOpen ? 'Ocultar usuários' : 'Ver usuários'}
                    </button>
                  )}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{description}</p>
              </div>

              <div className="px-5 py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide pb-2 w-40">Módulo</th>
                      {['Visualizar', 'Criar/Editar'].map(h => (
                        <th key={h} className="text-center text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wide pb-2 w-24">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {MODULOS.map(m => (
                      <tr key={m.id}>
                        <td className="py-1.5 pr-4">
                          <p className="font-medium text-slate-700 dark:text-slate-300">{m.label}</p>
                          <p className="text-slate-400 dark:text-slate-500">{m.desc}</p>
                        </td>
                        <td className="text-center py-1.5">
                          {perms[m.id]?.ver
                            ? <svg className="w-4 h-4 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            : <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                        </td>
                        <td className="text-center py-1.5">
                          {perms[m.id]?.editar
                            ? <svg className="w-4 h-4 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                            : <svg className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isOpen && roleUsers.length > 0 && (
                <div className="border-t border-slate-100 dark:border-slate-800 px-5 py-3">
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">Usuários com este perfil</p>
                  <div className="space-y-1.5">
                    {roleUsers.map(u => (
                      <div key={u.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold">
                            {u.nome.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-700 dark:text-slate-300">{u.nome}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">{u.email}</span>
                        </div>
                        <select
                          value={u.role}
                          onChange={e => setChangingRole({ userId: u.id, newRole: e.target.value as Role })}
                          className="text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          {ROLES.map(r => <option key={r.role} value={r.role}>{r.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-4 text-sm text-amber-700 dark:text-amber-300">
        <strong>Nota:</strong> As permissões exibidas refletem o comportamento padrão do sistema por perfil. Para alterar o perfil de um usuário, expanda o perfil desejado e use o seletor ao lado do nome do usuário.
      </div>

      {/* Confirm role change */}
      {changingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Alterar perfil?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              O usuário receberá o perfil de <strong>{ROLES.find(r => r.role === changingRole.newRole)?.label}</strong> imediatamente.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setChangingRole(null)} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={applyRoleChange} disabled={saving} className="flex-1 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">{saving ? 'Salvando...' : 'Confirmar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PermissoesPage;
