/**
 * Service para gerenciar Roles e Permissões do Tenant
 * Segue o padrão esperado pelo hook useCrud
 */
import api from '../api';
import type { CrudService, ListParams, ApiResponse } from '../../types';

export interface ModulePermission {
  id?: number;
  module: string;
  module_display?: string;
  actions: string[];
}

export interface AvailableModule {
  code: string;
  name: string;
  description: string;
  actions: string[];
  submodules?: Record<string, string>;
}

export interface CustomRole {
  id: number;
  tenant: number;
  name: string;
  code: string;
  description: string;
  is_active: boolean;
  is_system: boolean;
  module_permissions: ModulePermission[];
  permissions_count: number;
  created_at: string;
  updated_at: string;
}

export interface CustomRoleCreate {
  name: string;
  code: string;
  description?: string;
  is_active?: boolean;
  module_permissions?: ModulePermission[];
}

export interface CustomRoleUpdate {
  name?: string;
  code?: string;
  description?: string;
  is_active?: boolean;
  module_permissions?: ModulePermission[];
}

export const rolesService: CrudService<CustomRole> = {
  // Listar todos os roles (compatível com useCrud)
  list: async (params: ListParams = {}): Promise<ApiResponse<CustomRole> | CustomRole[]> => {
    const drfParams: Record<string, unknown> = { ...params };
    if ('pageSize' in drfParams && drfParams.pageSize) {
      drfParams.page_size = drfParams.pageSize;
      delete drfParams.pageSize;
    }
    const response = await api.get<ApiResponse<CustomRole>>('/accounts/roles/', { params: drfParams });
    return response.data;
  },

  // Buscar role por ID (compatível com useCrud)
  get: async (id: number | string): Promise<CustomRole> => {
    const response = await api.get<CustomRole>(`/accounts/roles/${id}/`);
    return response.data;
  },

  // Criar novo role (compatível com useCrud)
  create: async (dados: Partial<CustomRole>): Promise<CustomRole> => {
    const response = await api.post<CustomRole>('/accounts/roles/', dados);
    return response.data;
  },

  // Atualizar role (compatível com useCrud)
  update: async (id: number | string, dados: Partial<CustomRole>): Promise<CustomRole> => {
    const response = await api.put<CustomRole>(`/accounts/roles/${id}/`, dados);
    return response.data;
  },

  // Excluir role (compatível com useCrud)
  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/accounts/roles/${id}/`);
  },
};

// Funções auxiliares
export const rolesServiceHelpers = {
  // Obter módulos disponíveis
  getAvailableModules: async (): Promise<AvailableModule[]> => {
    const response = await api.get<AvailableModule[]>('/accounts/roles/available_modules/');
    return response.data;
  },

  // Duplicar role
  duplicate: async (id: number | string): Promise<CustomRole> => {
    const response = await api.post<CustomRole>(`/accounts/roles/${id}/duplicate/`);
    return response.data;
  },
};

