import api from './api';

export const pessoasService = {
  // Listar todas as pessoas
  listar: async (params = {}) => {
    const response = await api.get('/pessoas/', { params });
    return response.data;
  },

  // Buscar pessoa por código
  buscar: async (codigo) => {
    const response = await api.get(`/pessoas/${codigo}/`);
    return response.data;
  },

  // Criar nova pessoa
  criar: async (dados) => {
    const response = await api.post('/pessoas/', dados);
    return response.data;
  },

  // Atualizar pessoa
  atualizar: async (codigo, dados) => {
    const response = await api.put(`/pessoas/${codigo}/`, dados);
    return response.data;
  },

  // Excluir pessoa
  excluir: async (codigo) => {
    const response = await api.delete(`/pessoas/${codigo}/`);
    return response.data;
  },

  // Buscar próximo código disponível
  proximoCodigo: async () => {
    const response = await api.get('/pessoas/proximo-codigo/');
    return response.data;
  },
};

