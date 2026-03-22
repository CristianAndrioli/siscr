import { useState, useEffect, useCallback } from 'react';
import { usuariosServiceHelpers } from '../services/accounts/usuarios';
import api from '../services/api';

export interface UserPermissions {
  role: string;
  role_display: string;
  permissions: string[];
  modules: Record<string, {
    name: string;
    actions: string[];
  }>;
}

/**
 * Hook para gerenciar permissões do usuário atual
 */
export function usePermissions() {
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar permissões do usuário atual
      const response = await api.get<UserPermissions>('/accounts/usuarios/me/permissions/');
      console.log('[usePermissions] Permissões recebidas:', response.data);
      setPermissions(response.data);
    } catch (err) {
      console.error('[usePermissions] Erro ao carregar permissões:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar permissões');
      // Em caso de erro, não assumir admin - deixar sem permissões
      // Isso força o usuário a ter permissões válidas
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  /**
   * Verifica se o usuário tem uma permissão específica
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!permissions) return false;
    
    // Admin sempre tem todas as permissões
    if (permissions.role === 'admin') return true;
    
    return permissions.permissions.includes(permission);
  }, [permissions]);

  /**
   * Verifica se o usuário tem acesso a um módulo específico
   */
  const hasModuleAccess = useCallback((moduleCode: string): boolean => {
    if (!permissions) {
      console.log(`[hasModuleAccess] Sem permissões para módulo ${moduleCode}`);
      return false;
    }
    
    // Admin sempre tem acesso a todos os módulos
    if (permissions.role === 'admin') {
      console.log(`[hasModuleAccess] Admin tem acesso a ${moduleCode}`);
      return true;
    }
    
    // Verificar se o módulo está nas permissões
    const hasAccess = moduleCode in permissions.modules;
    console.log(`[hasModuleAccess] Módulo ${moduleCode}:`, {
      hasAccess,
      role: permissions.role,
      modules: Object.keys(permissions.modules),
      moduleData: permissions.modules[moduleCode],
    });
    return hasAccess;
  }, [permissions]);

  /**
   * Verifica se o usuário tem uma ação específica em um módulo
   */
  const hasModuleAction = useCallback((moduleCode: string, action: string): boolean => {
    if (!permissions) return false;
    
    // Admin sempre tem todas as ações
    if (permissions.role === 'admin') return true;
    
    const module = permissions.modules[moduleCode];
    if (!module) return false;
    
    return module.actions.includes(action);
  }, [permissions]);

  /**
   * Retorna as ações permitidas para um módulo
   */
  const getModuleActions = useCallback((moduleCode: string): string[] => {
    if (!permissions) return [];
    
    // Admin sempre tem todas as ações
    if (permissions.role === 'admin') {
      return ['view', 'add', 'change', 'delete', 'export', 'import', 'approve', 'reject', 'manage'];
    }
    
    const module = permissions.modules[moduleCode];
    return module?.actions || [];
  }, [permissions]);

  return {
    permissions,
    loading,
    error,
    hasPermission,
    hasModuleAccess,
    hasModuleAction,
    getModuleActions,
    refresh: loadPermissions,
  };
}

