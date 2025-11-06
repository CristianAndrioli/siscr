/**
 * Service para gerenciar Produtos
 */
import api from '../api';

export const produtosService = {
  listar: async (params = {}) => {
    const response = await api.get('/cadastros/produtos/', { params });
    return response.data;
  },

  buscar: async (codigo) => {
    const response = await api.get(`/cadastros/produtos/${codigo}/`);
    return response.data;
  },

  criar: async (dados) => {
    const response = await api.post('/cadastros/produtos/', dados);
    return response.data;
  },

  atualizar: async (codigo, dados) => {
    const response = await api.put(`/cadastros/produtos/${codigo}/`, dados);
    return response.data;
  },

  excluir: async (codigo) => {
    const response = await api.delete(`/cadastros/produtos/${codigo}/`);
    return response.data;
  },

  proximoCodigo: async () => {
    const response = await api.get('/cadastros/produtos/proximo-codigo/');
    return response.data;
  },
};

