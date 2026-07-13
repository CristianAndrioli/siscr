import api from './api';

export interface MetaVendedor {
  id: string;
  nome: string;
  meta_id: string | null;
  valor_meta: number | null;
  valor_realizado: number;
}

export const metasVendasService = {
  list: async (ano: number, mes: number): Promise<MetaVendedor[]> => {
    const r = await api.get('/tenant/vendas/metas', { params: { ano, mes } });
    return r.data.vendedores ?? [];
  },

  salvar: async (vendedorId: string, ano: number, mes: number, valorMeta: number): Promise<void> => {
    await api.put('/tenant/vendas/metas', { vendedorId, ano, mes, valorMeta });
  },
};
