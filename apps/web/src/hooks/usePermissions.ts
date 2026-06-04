import { useCallback, useMemo, useState, useEffect } from 'react';
import api from '../services/api';

export interface UserPermissions {
  role: string;
  role_display: string;
  permissions: string[];
  modules: Record<string, { name: string; actions: string[] }>;
}

const MODULE_KEYS = ['cadastros', 'financeiro', 'faturamento', 'estoque', 'frota', 'configuracoes'] as const;

const ALL_ACTIONS = ['view', 'add', 'change', 'delete', 'export', 'import', 'approve', 'reject', 'manage'];

function buildAdminPermissions(): UserPermissions {
  const modules: UserPermissions['modules'] = {};
  MODULE_KEYS.forEach((m) => {
    modules[m] = { name: m, actions: ALL_ACTIONS };
  });
  return {
    role: 'admin',
    role_display: 'Administrador',
    permissions: ['*'],
    modules,
  };
}

/** Fallback quando `modules` não veio na sessão (sessões antigas). */
function builtInMatrix(role: string): Record<string, { view: boolean; edit: boolean }> {
  const m: Record<string, { view: boolean; edit: boolean }> = {};
  for (const k of MODULE_KEYS) m[k] = { view: false, edit: false };
  if (role === 'admin') {
    for (const k of MODULE_KEYS) m[k] = { view: true, edit: true };
    return m;
  }
  if (role === 'manager' || role === 'user') {
    for (const k of MODULE_KEYS) {
      if (k === 'configuracoes') m[k] = { view: false, edit: false };
      else m[k] = { view: true, edit: true };
    }
    return m;
  }
  if (role === 'viewer') {
    for (const k of MODULE_KEYS) {
      if (k === 'configuracoes') m[k] = { view: false, edit: false };
      else m[k] = { view: true, edit: false };
    }
    return m;
  }
  return m;
}

function allModulesDenied(): Record<string, { view: boolean; edit: boolean }> {
  const m: Record<string, { view: boolean; edit: boolean }> = {};
  for (const k of MODULE_KEYS) m[k] = { view: false, edit: false };
  return m;
}

/**
 * Mescla a matriz vinda da API/sessão. Objeto vazio `{}` = nenhum módulo (não cair no fallback generoso do perfil).
 * Perfil personalizado sem matriz no storage = negar tudo (evita tratar como viewer/user padrão).
 * Só usa builtInMatrix quando não há `modules` nem perfil personalizado (legado).
 */
function mergeModulesFromApi(
  apiModules: Record<string, { view: boolean; edit: boolean }> | undefined,
  role: string,
  customRoleId?: string | null,
): Record<string, { view: boolean; edit: boolean }> {
  if (apiModules != null && typeof apiModules === 'object') {
    const m: Record<string, { view: boolean; edit: boolean }> = {};
    for (const k of MODULE_KEYS) {
      const cell = apiModules[k];
      if (cell && typeof cell === 'object') {
        m[k] = { view: !!cell.view, edit: !!cell.edit };
      } else {
        m[k] = { view: false, edit: false };
      }
    }
    return m;
  }
  if (customRoleId) {
    return allModulesDenied();
  }
  return builtInMatrix(role);
}

function matrixToModules(
  matrix: Record<string, { view: boolean; edit: boolean }>
): UserPermissions['modules'] {
  const out: UserPermissions['modules'] = {};
  for (const key of MODULE_KEYS) {
    const cell = matrix[key];
    if (!cell?.view) continue;
    const actions: string[] = ['view'];
    if (cell.edit) {
      actions.push('add', 'change', 'delete', 'export', 'import', 'approve', 'reject', 'manage');
    }
    out[key] = { name: key, actions };
  }
  return out;
}

function getLocalUser(): {
  id?: string;
  role?: string;
  modules?: Record<string, { view: boolean; edit: boolean }>;
  customRoleId?: string | null;
  customRoleNome?: string;
} {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  user: 'Usuário',
  viewer: 'Visualizador',
};

/**
 * Permissões efetivas: admin = tudo; senão `user.modules` da API/sessão; senão matriz padrão do perfil.
 */
export function usePermissions() {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onStorage = () => setVersion((v) => v + 1);
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const localUser = useMemo(() => getLocalUser(), [version]);
  const role = localUser.role || 'user';
  const isAdmin = role === 'admin';
  const apiModules = localUser.modules;

  const permissions: UserPermissions = useMemo(() => {
    if (isAdmin) return buildAdminPermissions();
    const matrix = mergeModulesFromApi(apiModules, role, localUser.customRoleId);
    return {
      role,
      role_display: localUser.customRoleNome || ROLE_LABEL[role] || 'Usuário',
      permissions: [],
      modules: matrixToModules(matrix),
    };
  }, [isAdmin, role, apiModules, localUser.customRoleId, localUser.customRoleNome]);

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

  const refresh = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const { data } = await api.get('/auth/me');
      const s = data as {
        userId: string;
        email: string;
        nome: string;
        role: string;
        customRoleId?: string | null;
        modules?: Record<string, { view: boolean; edit: boolean }>;
      };
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: s.userId,
          email: s.email,
          nome: s.nome,
          role: s.role,
          modules: s.modules,
          customRoleId: s.customRoleId ?? null,
        })
      );
      setVersion((v) => v + 1);
    } catch {
      setVersion((v) => v + 1);
    }
  }, []);

  return {
    permissions,
    loading: false,
    error: null,
    hasPermission,
    hasModuleAccess,
    hasModuleAction,
    getModuleActions,
    refresh,
  };
}
