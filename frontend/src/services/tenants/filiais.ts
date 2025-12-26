/**
 * Service para gerenciar Filiais do Tenant
 */
import api from '../api';
import type { CrudService, ListParams, ApiResponse } from '../../types';

export interface Filial {
  id: number;
  empresa: number;
  empresa_nome: string;
  nome: string;
  codigo_filial: string | null;
  cnpj: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FilialCreate {
  empresa: number;
  nome: string;
  codigo_filial?: string;
  cnpj?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  is_active?: boolean;
}

export interface FilialUpdate extends Partial<FilialCreate> {}

class FiliaisService implements CrudService<Filial, FilialCreate, FilialUpdate> {
  private baseUrl = '/tenants/filiais/';

  async list(params?: ListParams): Promise<ApiResponse<Filial>> {
    const response = await api.get<ApiResponse<Filial>>(this.baseUrl, { params });
    return response.data;
  }

  async get(id: number): Promise<Filial> {
    const response = await api.get<Filial>(`${this.baseUrl}${id}/`);
    return response.data;
  }

  async create(data: FilialCreate): Promise<Filial> {
    const response = await api.post<Filial>(this.baseUrl, data);
    return response.data;
  }

  async update(id: number, data: FilialUpdate): Promise<Filial> {
    const response = await api.patch<Filial>(`${this.baseUrl}${id}/`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`${this.baseUrl}${id}/`);
  }
}

export const filiaisService = new FiliaisService();

// Helpers para compatibilidade
export const filiaisServiceHelpers = {
  list: (params?: ListParams) => filiaisService.list(params),
  get: (id: number) => filiaisService.get(id),
  create: (data: FilialCreate) => filiaisService.create(data),
  update: (id: number, data: FilialUpdate) => filiaisService.update(id, data),
  delete: (id: number) => filiaisService.delete(id),
};

