/**
 * Service para gerenciar Serviços
 */
import api from '../api';

export const servicosService = {
  list: async (params = {}) => {
    const drfParams = { ...params };
    if (drfParams.pageSize) {
      drfParams.page_size = drfParams.pageSize;
      delete drfParams.pageSize;
    }
    const response = await api.get('/cadastros/servicos/', { params: drfParams });
    return response.data;
  },

  get: async (codigo) => {
    const response = await api.get(`/cadastros/servicos/${codigo}/`);
    return response.data;
  },

  create: async (dados) => {
    const response = await api.post('/cadastros/servicos/', dados);
    return response.data;
  },

  update: async (codigo, dados) => {
    const response = await api.put(`/cadastros/servicos/${codigo}/`, dados);
    return response.data;
  },

  delete: async (codigo) => {
    const response = await api.delete(`/cadastros/servicos/${codigo}/`);
    return response.data;
  },

  proximoCodigo: async () => {
    const response = await api.get('/cadastros/servicos/proximo_codigo/');
    return response.data;
  },
};

