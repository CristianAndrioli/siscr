import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { rolesService, rolesServiceHelpers, type CustomRole, type CustomRoleCreate, type CustomRoleUpdate, type AvailableModule, type ModulePermission } from '../../services/accounts/roles';
import { Input, Select, Button, Alert, Checkbox } from '../../components/common';
import { useForm } from '../../hooks/useForm';
import { formatApiError } from '../../utils/helpers';

const ACTION_LABELS: Record<string, string> = {
  view: 'Visualizar',
  add: 'Criar',
  change: 'Editar',
  delete: 'Excluir',
  export: 'Exportar',
  import: 'Importar',
  approve: 'Aprovar',
  reject: 'Rejeitar',
  manage: 'Gerenciar',
};

function RolesForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const editando = !!id;

  const initialValues: CustomRoleCreate | CustomRoleUpdate = {
    name: '',
    code: '',
    description: '',
    is_active: true,
    module_permissions: [],
  };

  const { formData, handleChange, setFormData, resetForm } = useForm(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [availableModules, setAvailableModules] = useState<AvailableModule[]>([]);
  const [modulePermissions, setModulePermissions] = useState<Record<string, string[]>>({});

  // Carregar módulos disponíveis
  const carregarModulos = useCallback(async () => {
    try {
      const modules = await rolesServiceHelpers.getAvailableModules();
      setAvailableModules(modules);
      
      // Inicializar permissões vazias para cada módulo
      const initialPerms: Record<string, string[]> = {};
      modules.forEach(module => {
        initialPerms[module.code] = [];
      });
      setModulePermissions(initialPerms);
    } catch (error) {
      console.error('Erro ao carregar módulos:', error);
      setError('Erro ao carregar módulos disponíveis');
    }
  }, []);

  // Carregar dados do role
  const carregarDados = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError('');
      const dados = await rolesService.get(id);
      
      setFormData({
        name: dados.name,
        code: dados.code,
        description: dados.description || '',
        is_active: dados.is_active,
        module_permissions: dados.module_permissions || [],
      });
      
      // Mapear permissões por módulo
      const perms: Record<string, string[]> = {};
      dados.module_permissions.forEach((perm: ModulePermission) => {
        perms[perm.module] = perm.actions || [];
      });
      setModulePermissions(perms);
    } catch (error) {
      console.error('Erro ao carregar dados do role:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados do role';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id, setFormData]);

  useEffect(() => {
    carregarModulos();
  }, [carregarModulos]);

  useEffect(() => {
    if (editando && id) {
      carregarDados();
    } else if (!editando) {
      resetForm(initialValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, id]);

  // Toggle de ação em um módulo
  const toggleModuleAction = (moduleCode: string, action: string) => {
    setModulePermissions(prev => {
      const current = prev[moduleCode] || [];
      const updated = current.includes(action)
        ? current.filter(a => a !== action)
        : [...current, action];
      return { ...prev, [moduleCode]: updated };
    });
  };

  // Selecionar todas as ações de um módulo
  const selectAllModuleActions = (module: AvailableModule) => {
    setModulePermissions(prev => ({
      ...prev,
      [module.code]: [...module.actions],
    }));
  };

  // Desmarcar todas as ações de um módulo
  const deselectAllModuleActions = (moduleCode: string) => {
    setModulePermissions(prev => ({
      ...prev,
      [moduleCode]: [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validar código
      if (!formData.code) {
        setError('O código do role é obrigatório');
        setLoading(false);
        return;
      }

      // Validar nome
      if (!formData.name) {
        setError('O nome do role é obrigatório');
        setLoading(false);
        return;
      }

      // Converter permissões para o formato esperado
      const modulePerms: ModulePermission[] = [];
      Object.entries(modulePermissions).forEach(([moduleCode, actions]) => {
        if (actions.length > 0) {
          const module = availableModules.find(m => m.code === moduleCode);
          modulePerms.push({
            module: moduleCode,
            module_display: module?.name || moduleCode,
            actions: actions,
          });
        }
      });

      const submitData = {
        ...formData,
        module_permissions: modulePerms,
      };

      if (editando) {
        await rolesService.update(id!, submitData as CustomRoleUpdate);
      } else {
        await rolesService.create(submitData as CustomRoleCreate);
      }
      navigate('/configuracoes/roles');
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
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
        {editando ? 'Editar Role' : 'Novo Role'}
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
              label="Nome do Role"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="Ex: Gerente Financeiro"
            />

            <Input
              label="Código"
              name="code"
              value={formData.code}
              onChange={handleChange}
              required
              disabled={editando}
              placeholder="Ex: gerente_financeiro"
            />
            {editando ? (
              <p className="text-xs text-gray-500 mt-1">O código não pode ser alterado após a criação</p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">Código único (sem espaços, use _ para separar)</p>
            )}
          </div>

          <div>
            <Input
              label="Descrição"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Descreva o que este role permite fazer"
            />
          </div>

          <div className="flex items-center">
            <Checkbox
              label="Role Ativo"
              name="is_active"
              checked={formData.is_active}
              onChange={(e) => handleChange({ target: { name: 'is_active', value: e.target.checked } })}
            />
          </div>
        </div>

        {/* Permissões por Módulo */}
        <div className="space-y-6">
          <h3 className="text-xl font-semibold text-gray-700 border-b pb-2">
            Permissões por Módulo
          </h3>
          
          <p className="text-sm text-gray-600 mb-4">
            Selecione as ações permitidas para cada módulo. Deixe vazio para negar acesso ao módulo.
          </p>

          {availableModules.map((module) => (
            <div key={module.code} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-gray-800">{module.name}</h4>
                  {module.description && (
                    <p className="text-sm text-gray-600">{module.description}</p>
                  )}
                  {module.submodules && Object.keys(module.submodules).length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Submódulos: {Object.values(module.submodules).join(', ')}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => selectAllModuleActions(module)}
                  >
                    Todas
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => deselectAllModuleActions(module.code)}
                  >
                    Nenhuma
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {module.actions.map((action) => {
                  const isChecked = (modulePermissions[module.code] || []).includes(action);
                  return (
                    <label
                      key={action}
                      className="flex items-center p-2 rounded border cursor-pointer hover:bg-gray-100 transition"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleModuleAction(module.code, action)}
                        className="mr-2"
                      />
                      <span className="text-sm">{ACTION_LABELS[action] || action}</span>
                    </label>
                  );
                })}
              </div>
              
              {modulePermissions[module.code] && modulePermissions[module.code].length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {modulePermissions[module.code].length} ação(ões) selecionada(s)
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Botões */}
        <div className="flex justify-end gap-4 pt-6 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/configuracoes/roles')}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={resetForm}
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

export default RolesForm;

