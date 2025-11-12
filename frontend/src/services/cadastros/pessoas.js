/**
 * Service para gerenciar Pessoas (Cadastro Geral)
 * Segue o padrão esperado pelo hook useCrud
 */
import api from '../api';

export const pessoasService = {
  // Listar todas as pessoas (compatível com useCrud)
  list: async (params = {}) => {
    // Converter pageSize para page_size (padrão do DRF)
    const drfParams = { ...params };
    if (drfParams.pageSize) {
      drfParams.page_size = drfParams.pageSize;
      delete drfParams.pageSize;
    }
    const response = await api.get('/cadastros/pessoas/', { params: drfParams });
    return response.data;
  },

  // Buscar pessoa por código (compatível com useCrud)
  get: async (codigo) => {
    const response = await api.get(`/cadastros/pessoas/${codigo}/`);
    return response.data;
  },

  // Criar nova pessoa (compatível com useCrud)
  create: async (dados) => {
    const response = await api.post('/cadastros/pessoas/', dados);
    return response.data;
  },

  // Atualizar pessoa (compatível com useCrud)
  update: async (codigo, dados) => {
    const response = await api.put(`/cadastros/pessoas/${codigo}/`, dados);
    return response.data;
  },

  // Excluir pessoa (compatível com useCrud)
  delete: async (codigo) => {
    const response = await api.delete(`/cadastros/pessoas/${codigo}/`);
    return response.data;
  },

  // Métodos legados (mantidos para compatibilidade)
  listar: async (params = {}) => {
    return pessoasService.list(params);
  },

  buscar: async (codigo) => {
    return pessoasService.get(codigo);
  },

  criar: async (dados) => {
    return pessoasService.create(dados);
  },

  atualizar: async (codigo, dados) => {
    return pessoasService.update(codigo, dados);
  },

  excluir: async (codigo) => {
    return pessoasService.delete(codigo);
  },

  // Buscar próximo código disponível
  proximoCodigo: async () => {
    const response = await api.get('/cadastros/pessoas/proximo_codigo/');
    return response.data;
  },
};

