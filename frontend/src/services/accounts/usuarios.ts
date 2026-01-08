/**
 * Service para gerenciar Usuários do Tenant
 * Segue o padrão esperado pelo hook useCrud
 */
import api from '../api';
import type { CrudService, ListParams, ApiResponse } from '../../types';

export interface Usuario {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  profile: {
    phone: string;
    current_tenant_id: number;
    current_empresa_id: number | null;
    current_filial_id: number | null;
  } | null;
  membership: {
    id: number;
    role: 'admin' | 'manager' | 'user' | 'viewer';
    role_display: string;
    is_active: boolean;
    joined_at: string;
  } | null;
  role: 'admin' | 'manager' | 'user' | 'viewer' | null;
  is_active_membership: boolean;
}

export interface UsuarioCreate {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  role: 'admin' | 'manager' | 'user' | 'viewer';
}

export interface UsuarioUpdate {
  username?: string;
  email?: string;
  password?: string;
  password_confirm?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  role?: 'admin' | 'manager' | 'user' | 'viewer';
}

export const usuariosService: CrudService<Usuario> = {
  // Listar todos os usuários (compatível com useCrud)
  list: async (params: ListParams = {}): Promise<ApiResponse<Usuario> | Usuario[]> => {
    // Converter pageSize para page_size (padrão do DRF)
    const drfParams: Record<string, unknown> = { ...params };
    if ('pageSize' in drfParams && drfParams.pageSize) {
      drfParams.page_size = drfParams.pageSize;
      delete drfParams.pageSize;
    }
    const response = await api.get<ApiResponse<Usuario>>('/accounts/usuarios/', { params: drfParams });
    return response.data;
  },

  // Buscar usuário por ID (compatível com useCrud)
  get: async (id: number | string): Promise<Usuario> => {
    const response = await api.get<Usuario>(`/accounts/usuarios/${id}/`);
    return response.data;
  },

  // Criar novo usuário (compatível com useCrud)
  create: async (dados: Partial<Usuario>): Promise<Usuario> => {
    const response = await api.post<Usuario>('/accounts/usuarios/', dados);
    return response.data;
  },

  // Atualizar usuário (compatível com useCrud)
  update: async (id: number | string, dados: Partial<Usuario>): Promise<Usuario> => {
    const response = await api.put<Usuario>(`/accounts/usuarios/${id}/`, dados);
    return response.data;
  },

  // Excluir usuário (compatível com useCrud) - na verdade desativa o membership
  delete: async (id: number | string): Promise<void> => {
    await api.delete(`/accounts/usuarios/${id}/`);
  },
};

// Funções auxiliares
export const usuariosServiceHelpers = {
  // Reativar usuário
  activate: async (id: number | string): Promise<void> => {
    await api.post(`/accounts/usuarios/${id}/activate/`);
  },

  // Obter permissões do usuário
  getPermissions: async (id: number | string): Promise<{
    role: string;
    role_display: string;
    permissions: string[];
  }> => {
    const response = await api.get(`/accounts/usuarios/${id}/permissions/`);
    return response.data;
  },
};

