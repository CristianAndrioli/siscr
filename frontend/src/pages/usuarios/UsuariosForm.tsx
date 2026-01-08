import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usuariosService, usuariosServiceHelpers, type Usuario, type UsuarioCreate, type UsuarioUpdate } from '../../services/accounts/usuarios';
import { rolesService, type CustomRole } from '../../services/accounts/roles';
import { Input, Select, Button, Alert, Checkbox } from '../../components/common';
import { useForm } from '../../hooks/useForm';
import { formatApiError } from '../../utils/helpers';
import UsuariosDetail from './UsuariosDetail';

const SYSTEM_ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'manager', label: 'Gerente' },
  { value: 'user', label: 'Usuário' },
  { value: 'viewer', label: 'Visualizador' },
];

const PERMISSIONS_BY_ROLE: Record<string, string[]> = {
  admin: [
    'Visualizar',
    'Criar',
    'Editar',
    'Excluir',
    'Gerenciar Usuários',
    'Gerenciar Permissões',
    'Gerenciar Empresas',
    'Gerenciar Filiais',
    'Gerenciar Configurações',
    'Gerenciar Assinaturas',
    'Acesso Total',
  ],
  manager: [
    'Visualizar',
    'Criar',
    'Editar',
  ],
  user: [
    'Visualizar',
    'Criar',
  ],
  viewer: [
    'Visualizar',
  ],
};

function UsuariosForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const editando = !!id && isEditMode;
  
  const initialValues: UsuarioCreate | UsuarioUpdate = {
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    is_active: true,
    role: 'user',
  };

  const { formData, handleChange, setFormData, resetForm } = useForm(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [roleOptions, setRoleOptions] = useState(SYSTEM_ROLE_OPTIONS);

  // Carregar roles customizados do tenant
  const carregarRolesCustomizados = useCallback(async () => {
    try {
      const roles = await rolesService.list();
      const rolesList = Array.isArray(roles) ? roles : (roles as any).results || [];
      const rolesAtivos = rolesList.filter((role: CustomRole) => role.is_active);
      setCustomRoles(rolesAtivos);
      
      // Combinar roles do sistema com roles customizados
      const customRoleOptions = rolesAtivos.map((role: CustomRole) => ({
        value: role.code,
        label: role.name,
      }));
      
      setRoleOptions([...SYSTEM_ROLE_OPTIONS, ...customRoleOptions]);
    } catch (error) {
      console.warn('Erro ao carregar roles customizados:', error);
      // Se falhar, usar apenas os roles do sistema
      setRoleOptions(SYSTEM_ROLE_OPTIONS);
    }
  }, []);

  const carregarDados = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError('');
      const dados = await usuariosService.get(id);
      
      // Carregar permissões do usuário (opcional, não falhar se der erro)
      try {
        const perms = await usuariosServiceHelpers.getPermissions(id);
        setPermissions(perms.permissions);
      } catch (permError) {
        // Se não conseguir carregar permissões, usar as permissões baseadas na role
        console.warn('Erro ao carregar permissões, usando permissões padrão da role:', permError);
        if (dados.role) {
          setPermissions(PERMISSIONS_BY_ROLE[dados.role] || []);
        }
      }
      
      setFormData({
        username: dados.username,
        email: dados.email,
        first_name: dados.first_name || '',
        last_name: dados.last_name || '',
        is_active: dados.is_active,
        role: dados.role || 'user',
        // Não incluir senha na edição
        password: '',
        password_confirm: '',
      });
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados do usuário';
      setError(errorMessage);
      // Não tentar recarregar automaticamente para evitar loop
    } finally {
      setLoading(false);
    }
  }, [id, setFormData]);

  // Carregar roles customizados ao montar o componente
  useEffect(() => {
    carregarRolesCustomizados();
  }, [carregarRolesCustomizados]);

  useEffect(() => {
    if (editando && id) {
      carregarDados();
    } else if (!editando) {
      resetForm(initialValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, id]); // Apenas editando e id como dependências para evitar loops

  // Atualizar permissões quando a role mudar
  useEffect(() => {
    if (formData.role) {
      setPermissions(PERMISSIONS_BY_ROLE[formData.role] || []);
    }
  }, [formData.role]);
  
  // Se há ID mas não está em modo de edição, mostrar DetailView
  // IMPORTANTE: Isso deve vir DEPOIS de todos os hooks para não violar as regras dos hooks
  if (id && !isEditMode) {
    return <UsuariosDetail />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validar senha na criação
      if (!editando) {
        if (!formData.password || !formData.password_confirm) {
          setError('Senha é obrigatória na criação de usuário');
          setLoading(false);
          return;
        }
        if (formData.password !== formData.password_confirm) {
          setError('As senhas não coincidem');
          setLoading(false);
          return;
        }
      }

      // Validar senha na edição (se fornecida)
      if (editando && formData.password) {
        if (formData.password !== formData.password_confirm) {
          setError('As senhas não coincidem');
          setLoading(false);
          return;
        }
      }

      if (editando && id) {
        // Remover campos vazios de senha na edição
        const updateData: UsuarioUpdate = { ...formData };
        if (!updateData.password) {
          delete updateData.password;
          delete updateData.password_confirm;
        }
        await usuariosService.update(id, updateData);
        // Após salvar, voltar para visualização
        navigate(`/usuarios/${id}`);
      } else {
        const novoUsuario = await usuariosService.create(formData as UsuarioCreate);
        // Após criar, ir para visualização do novo usuário
        navigate(`/usuarios/${novoUsuario.id}`);
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const limparFormulario = () => {
    resetForm(initialValues);
  };

  if (loading && editando) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-2xl transition-all duration-300">
      <h2 className="text-3xl font-extrabold text-gray-800 mb-6 border-b-2 border-indigo-600 pb-2">
        {editando ? 'Editar Usuário' : 'Novo Usuário'}
      </h2>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Informações Básicas */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-700 border-b pb-2">
            Informações Básicas
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Nome de Usuário"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={editando}
            />

            <Input
              label="E-mail"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
            />

            <Input
              label="Nome"
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
            />

            <Input
              label="Sobrenome"
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
            />
          </div>
        </div>

        {/* Senha */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-700 border-b pb-2">
            {editando ? 'Alterar Senha (opcional)' : 'Senha'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Senha"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required={!editando}
              placeholder={editando ? 'Deixe em branco para manter a senha atual' : ''}
            />

            <Input
              label="Confirmar Senha"
              name="password_confirm"
              type="password"
              value={formData.password_confirm}
              onChange={handleChange}
              required={!editando}
              placeholder={editando ? 'Deixe em branco para manter a senha atual' : ''}
            />
          </div>
        </div>

        {/* Permissões e Status */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-700 border-b pb-2">
            Permissões e Status
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select
              label="Papel (Role)"
              name="role"
              value={formData.role}
              onChange={handleChange}
              options={roleOptions}
              required
            />

            <div className="flex items-center pt-6">
              <Checkbox
                label="Usuário Ativo"
                name="is_active"
                checked={formData.is_active}
                onChange={(e) => handleChange({ target: { name: 'is_active', value: e.target.checked } })}
              />
            </div>
          </div>

          {/* Exibir permissões baseadas na role */}
          {formData.role && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Permissões do Papel "{roleOptions.find(r => r.value === formData.role)?.label}"
              </h4>
              <div className="flex flex-wrap gap-2">
                {permissions.map((perm) => (
                  <span
                    key={perm}
                    className="px-3 py-1 text-xs font-medium rounded-full bg-indigo-100 text-indigo-800"
                  >
                    {perm}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                As permissões são definidas automaticamente pelo papel selecionado.
              </p>
            </div>
          )}
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-4 pt-6 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/usuarios')}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={limparFormulario}
            disabled={loading || editando}
          >
            Limpar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
          >
            {loading ? 'Salvando...' : editando ? 'Atualizar' : 'Criar'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default UsuariosForm;

