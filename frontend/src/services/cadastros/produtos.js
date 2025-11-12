/**
 * Service para gerenciar Produtos
 */
import api from '../api';

export const produtosService = {
  list: async (params = {}) => {
    const drfParams = { ...params };
    if (drfParams.pageSize) {
      drfParams.page_size = drfParams.pageSize;
      delete drfParams.pageSize;
    }
    const response = await api.get('/cadastros/produtos/', { params: drfParams });
    return response.data;
  },

  get: async (codigo) => {
    const response = await api.get(`/cadastros/produtos/${codigo}/`);
    return response.data;
  },

  create: async (dados) => {
    const response = await api.post('/cadastros/produtos/', dados);
    return response.data;
  },

  update: async (codigo, dados) => {
    const response = await api.put(`/cadastros/produtos/${codigo}/`, dados);
    return response.data;
  },

  delete: async (codigo) => {
    const response = await api.delete(`/cadastros/produtos/${codigo}/`);
    return response.data;
  },

  proximoCodigo: async () => {
    const response = await api.get('/cadastros/produtos/proximo_codigo/');
    return response.data;
  },
};

