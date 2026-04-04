import api from './api';

export type ModuleKey = 'cadastros' | 'financeiro' | 'faturamento' | 'estoque' | 'configuracoes';

export interface PerfilRow {
  id: string;
  nome: string;
  created_at: string;
  updated_at: string | null;
  usuarios_count: number;
}

export interface ModuloPerm {
  moduleKey: ModuleKey;
  canView: boolean;
  canEdit: boolean;
}

export const permissoesApi = {
  listPerfis: () => api.get<{ perfis: PerfilRow[] }>('/tenant/permissoes/perfis'),
  getPerfil: (id: string) =>
    api.get<{ perfil: { id: string; nome: string; created_at: string; updated_at: string | null }; modulos: ModuloPerm[] }>(
      `/tenant/permissoes/perfis/${id}`
    ),
  createPerfil: (body: { nome: string; modulos: ModuloPerm[] }) =>
    api.post<{ id: string }>('/tenant/permissoes/perfis', body),
  updatePerfil: (id: string, body: { nome: string; modulos: ModuloPerm[] }) =>
    api.put(`/tenant/permissoes/perfis/${id}`, body),
  deletePerfil: (id: string) => api.delete(`/tenant/permissoes/perfis/${id}`),
};
