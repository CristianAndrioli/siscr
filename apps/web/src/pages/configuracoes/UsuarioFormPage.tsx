import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import api from '../../services/api';
import { authService } from '../../services/auth';
import { permissoesApi } from '../../services/permissoesApi';
import { usePermissions } from '../../hooks/usePermissions';
import { formatApiError } from '../../utils/helpers';

type Role = 'admin' | 'manager' | 'user' | 'viewer';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  user: 'Usuário',
  viewer: 'Visualizador',
};

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

export default function UsuarioFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = !id || id === 'novo';
  const { refresh: refreshPermissions } = usePermissions();
  const currentUserId = authService.getLocalUser()?.id;

  const [perfis, setPerfis] = useState<{ id: string; nome: string }[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    permissoesApi
      .listPerfis()
      .then((r) => setPerfis((r.data.perfis ?? []).map((p) => ({ id: p.id, nome: p.nome }))))
      .catch(() => setPerfis([]));
  }, []);

  const load = useCallback(async () => {
    if (isNew || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setFormError('');
    try {
      const res = await api.get('/tenant/info/usuarios');
      const usuarios = res.data.usuarios ?? [];
      const u = usuarios.find((x: { id: string }) => x.id === id);
      if (!u) {
        setFormError('Usuário não encontrado.');
        return;
      }
      setForm({
        email: u.email,
        nome: u.nome,
        role: u.role,
        senha: '',
        ativo: u.ativo === 1,
        customRoleId: u.custom_role_id ?? '',
      });
    } catch {
      setFormError('Erro ao carregar usuário.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (!form.nome.trim() || !form.email.trim()) {
      setFormError('Nome e e-mail são obrigatórios.');
      return;
    }
    if (isNew && !form.senha.trim()) {
      setFormError('Informe uma senha para o novo usuário.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (!isNew && id) {
        const customRoleId = form.role === 'admin' ? null : form.customRoleId || null;
        await api.put(`/tenant/info/usuarios/${id}`, {
          nome: form.nome,
          email: form.email,
          role: form.role,
          ativo: form.ativo,
          customRoleId,
        });
        if (id === currentUserId) await refreshPermissions();
      } else {
        await api.post('/tenant/info/usuarios', {
          nome: form.nome,
          email: form.email,
          role: form.role,
          senha: form.senha,
          ...(form.role !== 'admin' && form.customRoleId ? { customRoleId: form.customRoleId } : {}),
        });
      }
      navigate('/configuracoes/usuarios');
    } catch (err: unknown) {
      setFormError(formatApiError(err, 'Erro ao salvar.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando usuário..." />;
  }

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to="/configuracoes/usuarios"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar aos usuários
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          {isNew ? 'Novo Usuário' : 'Editar Usuário'}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Defina acesso e perfil no sistema.
        </p>
      </div>

      {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        {(
          [
            ['Nome completo', 'nome', 'text', true],
            ['E-mail', 'email', 'email', true],
          ] as const
        ).map(([label, field, type, req]) => (
          <div key={field}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {label} {req && <span className="text-red-500">*</span>}
            </label>
            <input
              type={type}
              value={form[field]}
              onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        ))}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Perfil de acesso
          </label>
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
              Quando definido, as permissões por módulo deste perfil substituem o padrão do
              Gerente/Usuário/Visualizador.
            </p>
          </div>
        )}

        {isNew && (
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Senha inicial <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={form.senha}
              onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))}
              placeholder="Mínimo 6 caracteres"
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              O usuário poderá alterar a senha no perfil após o primeiro acesso.
            </p>
          </div>
        )}

        {!isNew && (
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, ativo: !f.ativo }))}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${form.ativo ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.ativo ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
            <label className="text-sm text-slate-700 dark:text-slate-300">
              {form.ativo ? 'Usuário ativo' : 'Usuário inativo'}
            </label>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button
            variant="secondary"
            onClick={() => navigate('/configuracoes/usuarios')}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            {isNew ? 'Criar Usuário' : 'Salvar'}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
