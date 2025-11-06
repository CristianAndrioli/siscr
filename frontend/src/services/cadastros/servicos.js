/**
 * Service para gerenciar Serviços
 */
import api from '../api';

export const servicosService = {
  listar: async (params = {}) => {
    const response = await api.get('/cadastros/servicos/', { params });
    return response.data;
  },

  buscar: async (codigo) => {
    const response = await api.get(`/cadastros/servicos/${codigo}/`);
    return response.data;
  },

  criar: async (dados) => {
    const response = await api.post('/cadastros/servicos/', dados);
    return response.data;
  },

  atualizar: async (codigo, dados) => {
    const response = await api.put(`/cadastros/servicos/${codigo}/`, dados);
    return response.data;
  },

  excluir: async (codigo) => {
    const response = await api.delete(`/cadastros/servicos/${codigo}/`);
    return response.data;
  },

  proximoCodigo: async () => {
    const response = await api.get('/cadastros/servicos/proximo-codigo/');
    return response.data;
  },
};

