/**
 * Service para gerenciar Locations (Locais Físicos)
 */
import api from '../api';
import type { CrudService, ListParams, ApiResponse } from '../../types';

export interface Location {
  id: number;
  empresa: number;
  empresa_nome: string;
  filial: number | null;
  filial_nome: string | null;
  nome: string;
  codigo: string;
  tipo: 'LOJA' | 'ALMOXARIFADO' | 'ARMAZEM' | 'CENTRO_DISTRIBUICAO' | 'ESTOQUE_TERCEIRO' | 'OUTRO';
  logradouro: string;
  numero: string;
  letra: string | null;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  endereco_completo: string;
  permite_entrada: boolean;
  permite_saida: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationCreate {
  empresa: number;
  filial?: number | null;
  nome: string;
  codigo: string;
  tipo: Location['tipo'];
  logradouro: string;
  numero: string;
  letra?: string | null;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  permite_entrada?: boolean;
  permite_saida?: boolean;
  ativo?: boolean;
}

export interface LocationUpdate extends Partial<LocationCreate> {}

class LocationsService implements CrudService<Location, LocationCreate, LocationUpdate> {
  private baseUrl = '/estoque/locations/';

  async list(params?: ListParams): Promise<ApiResponse<Location>> {
    const response = await api.get<ApiResponse<Location>>(this.baseUrl, { params });
    return response.data;
  }

  async get(id: number): Promise<Location> {
    const response = await api.get<Location>(`${this.baseUrl}${id}/`);
    return response.data;
  }

  async create(data: LocationCreate): Promise<Location> {
    const response = await api.post<Location>(this.baseUrl, data);
    return response.data;
  }

  async update(id: number, data: LocationUpdate): Promise<Location> {
    const response = await api.patch<Location>(`${this.baseUrl}${id}/`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`${this.baseUrl}${id}/`);
  }
}

export const locationsService = new LocationsService();

