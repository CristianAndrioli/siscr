import api from './api';

export const produtosService = {
  listar: async (params = {}) => {
    const response = await api.get('/produtos/', { params });
    return response.data;
  },

  buscar: async (codigo) => {
    const response = await api.get(`/produtos/${codigo}/`);
    return response.data;
  },

  criar: async (dados) => {
    const response = await api.post('/produtos/', dados);
    return response.data;
  },

  atualizar: async (codigo, dados) => {
    const response = await api.put(`/produtos/${codigo}/`, dados);
    return response.data;
  },

  excluir: async (codigo) => {
    const response = await api.delete(`/produtos/${codigo}/`);
    return response.data;
  },

  proximoCodigo: async () => {
    const response = await api.get('/produtos/proximo-codigo/');
    return response.data;
  },
};

