import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { authService } from '../../services/auth';
import { formatApiError } from '../../utils/helpers';

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');

type Role = 'admin' | 'manager' | 'user' | 'viewer';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  user: 'Usuário',
  viewer: 'Visualizador',
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

export function UsuariosPage() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const currentUserId = authService.getLocalUser()?.id;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/tenant/info/usuarios');
      setUsuarios(res.data.usuarios ?? []);
    } catch {
      setError('Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/tenant/info/usuarios/${id}`);
      setDeleteConfirm(null);
      load();
    } catch (err: unknown) {
      setError(formatApiError(err, 'Erro ao excluir.'));
    }
  };

  const filtered = usuarios.filter(
    (u) =>
      !busca ||
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase()),
  );

  const ativos = usuarios.filter((u) => u.ativo === 1).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Usuários</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Gerencie quem tem acesso ao sistema
          </p>
        </div>
        <button
          onClick={() => navigate('/configuracoes/usuarios/novo')}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Novo Usuário
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          ['Total', usuarios.length],
          ['Ativos', ativos],
          ['Inativos', usuarios.length - ativos],
        ].map(([label, val]) => (
          <div
            key={label as string}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4"
          >
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              {label as string}
            </p>
            <p className="text-xl font-bold mt-1 text-slate-800 dark:text-slate-100">{val as number}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou e-mail..."
        className="w-full max-w-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
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
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 dark:text-slate-500 text-sm">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                {['Usuário', 'E-mail', 'Perfil', 'Permissão extra', 'Status', 'Desde', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 flex items-center justify-center text-xs font-bold flex-none">
                        {u.nome.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">{u.nome}</p>
                        {u.id === currentUserId && (
                          <span className="text-xs text-brand-500 font-medium">Você</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_STYLE[u.role]}`}
                    >
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[140px] truncate"
                    title={u.custom_role_nome ?? ''}
                  >
                    {u.role === 'admin' ? '—' : u.custom_role_nome || 'Padrão do perfil'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${u.ativo === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}
                    >
                      {u.ativo === 1 ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 dark:text-slate-500 text-xs">
                    {fmtDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/configuracoes/usuarios/${u.id}`)}
                        className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                      >
                        Editar
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => setDeleteConfirm(u.id)}
                          className="text-xs text-red-500 hover:underline font-medium"
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Excluir usuário?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              O usuário perderá acesso imediatamente. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm!)}
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

export default UsuariosPage;
