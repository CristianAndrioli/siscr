/**
 * Service para gerenciar Empresas do Tenant
 */
import api from '../api';
import type { CrudService, ListParams, ApiResponse } from '../../types';

export interface Empresa {
  id: number;
  nome: string;
  razao_social: string;
  cnpj: string;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  is_active: boolean;
  filiais_count: number;
  created_at: string;
  updated_at: string;
}

export interface EmpresaCreate {
  nome: string;
  razao_social: string;
  cnpj: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  is_active?: boolean;
}

export interface EmpresaUpdate extends Partial<EmpresaCreate> {}

class EmpresasService implements CrudService<Empresa, EmpresaCreate, EmpresaUpdate> {
  private baseUrl = '/tenants/empresas/';

  async list(params?: ListParams): Promise<ApiResponse<Empresa>> {
    const response = await api.get<ApiResponse<Empresa>>(this.baseUrl, { params });
    return response.data;
  }

  async get(id: number): Promise<Empresa> {
    const response = await api.get<Empresa>(`${this.baseUrl}${id}/`);
    return response.data;
  }

  async create(data: EmpresaCreate): Promise<Empresa> {
    const response = await api.post<Empresa>(this.baseUrl, data);
    return response.data;
  }

  async update(id: number, data: EmpresaUpdate): Promise<Empresa> {
    const response = await api.patch<Empresa>(`${this.baseUrl}${id}/`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`${this.baseUrl}${id}/`);
  }
}

export const empresasService = new EmpresasService();

// Helpers para compatibilidade
export const empresasServiceHelpers = {
  list: (params?: ListParams) => empresasService.list(params),
  get: (id: number) => empresasService.get(id),
  create: (data: EmpresaCreate) => empresasService.create(data),
  update: (id: number, data: EmpresaUpdate) => empresasService.update(id, data),
  delete: (id: number) => empresasService.delete(id),
};

