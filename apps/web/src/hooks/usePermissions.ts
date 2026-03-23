import { useCallback } from 'react';

export interface UserPermissions {
  role: string;
  role_display: string;
  permissions: string[];
  modules: Record<string, { name: string; actions: string[] }>;
}

const ALL_MODULES = [
  'cadastros',
  'financeiro',
  'faturamento',
  'estoque',
  'configuracoes',
  'monitoramento',
  'servico_logistico',
  'relatorios',
  'usuarios',
];

const ALL_ACTIONS = ['view', 'add', 'change', 'delete', 'export', 'import', 'approve', 'reject', 'manage'];

function buildAdminPermissions(): UserPermissions {
  const modules: UserPermissions['modules'] = {};
  ALL_MODULES.forEach((m) => {
    modules[m] = { name: m, actions: ALL_ACTIONS };
  });
  return {
    role: 'admin',
    role_display: 'Administrador',
    permissions: ['*'],
    modules,
  };
}

function getLocalUser(): { role?: string } {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

/**
 * Hook de permissões — lê o role do usuário salvo no localStorage após login.
 * Admin tem acesso total sem precisar chamar a API.
 * Roles futuros poderão buscar permissões granulares via API.
 */
export function usePermissions() {
  const localUser = getLocalUser();
  const role = localUser.role || 'user';
  const isAdmin = role === 'admin';

  const permissions: UserPermissions = isAdmin
    ? buildAdminPermissions()
    : { role, role_display: 'Usuário', permissions: [], modules: {} };

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (isAdmin) return true;
      return permissions.permissions.includes(permission);
    },
    [isAdmin, permissions.permissions]
  );

  const hasModuleAccess = useCallback(
    (moduleCode: string): boolean => {
      if (isAdmin) return true;
      return moduleCode in permissions.modules;
    },
    [isAdmin, permissions.modules]
  );

  const hasModuleAction = useCallback(
    (moduleCode: string, action: string): boolean => {
      if (isAdmin) return true;
      const mod = permissions.modules[moduleCode];
      if (!mod) return false;
      return mod.actions.includes(action);
    },
    [isAdmin, permissions.modules]
  );

  const getModuleActions = useCallback(
    (moduleCode: string): string[] => {
      if (isAdmin) return ALL_ACTIONS;
      return permissions.modules[moduleCode]?.actions || [];
    },
    [isAdmin, permissions.modules]
  );

  return {
    permissions,
    loading: false,
    error: null,
    hasPermission,
    hasModuleAccess,
    hasModuleAction,
    getModuleActions,
    refresh: () => {},
  };
}
