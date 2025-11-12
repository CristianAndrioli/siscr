import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook customizado para gerenciar operações CRUD
 * 
 * @param {Object} config
 * @param {Function} config.service - Serviço com métodos: list, get, create, update, delete
 * @param {string} config.basePath - Caminho base para navegação (ex: '/cadastros/pessoas')
 * @param {Function} config.getRecordId - Função para extrair ID do registro
 */
export function useCrud({ service, basePath, getRecordId = (record) => record.id || record.codigo_cadastro || record.codigo_produto || record.codigo_servico }) {
  const navigate = useNavigate();
  
  const [data, setData] = useState([]);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  // Listar registros
  const loadData = useCallback(async (page = 1, search = '') => {
    try {
      setLoading(true);
      setError('');
      
      const response = await service.list({
        page,
        pageSize: pagination.pageSize,
        search,
      });
      
      // Ajustar conforme a estrutura da resposta da API
      if (Array.isArray(response)) {
        setData(response);
        setPagination(prev => ({ ...prev, page, total: response.length }));
      } else if (response.results) {
        // Paginação do Django REST Framework
        setData(response.results);
        setPagination({
          page,
          pageSize: pagination.pageSize,
          total: response.count || response.results.length,
        });
      } else {
        setData(response.data || []);
        setPagination({
          page,
          pageSize: pagination.pageSize,
          total: response.total || response.data?.length || 0,
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao carregar dados');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [service, pagination.pageSize]);

  // Carregar um registro específico
  const loadRecord = useCallback(async (id) => {
    try {
      setLoading(true);
      setError('');
      const record = await service.get(id);
      setCurrentRecord(record);
      return record;
    } catch (err) {
      setError(err.response?.data?.message || 'Erro ao carregar registro');
      return null;
    } finally {
      setLoading(false);
    }
  }, [service]);

  // Criar registro
  const createRecord = useCallback(async (formData) => {
    try {
      setLoading(true);
      setError('');
      const newRecord = await service.create(formData);
      await loadData(pagination.page, searchTerm);
      return newRecord;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.detail || 'Erro ao criar registro';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [service, loadData, pagination.page, searchTerm]);

  // Atualizar registro
  const updateRecord = useCallback(async (id, formData) => {
    try {
      setLoading(true);
      setError('');
      const updatedRecord = await service.update(id, formData);
      await loadData(pagination.page, searchTerm);
      setCurrentRecord(updatedRecord);
      return updatedRecord;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.detail || 'Erro ao atualizar registro';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [service, loadData, pagination.page, searchTerm]);

  // Deletar registro
  const deleteRecord = useCallback(async (id) => {
    try {
      setLoading(true);
      setError('');
      await service.delete(id);
      await loadData(pagination.page, searchTerm);
      if (currentRecord && getRecordId(currentRecord) === id) {
        setCurrentRecord(null);
        navigate(basePath);
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.response?.data?.detail || 'Erro ao deletar registro';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [service, loadData, pagination.page, searchTerm, currentRecord, getRecordId, navigate, basePath]);

  // Navegação
  const handleViewRecord = useCallback((record) => {
    const id = getRecordId(record);
    navigate(`${basePath}/${id}`);
  }, [navigate, basePath, getRecordId]);

  const handleCreateRecord = useCallback(() => {
    navigate(`${basePath}/novo`);
  }, [navigate, basePath]);

  const handleEditRecord = useCallback((record) => {
    const id = getRecordId(record);
    navigate(`${basePath}/${id}/editar`);
  }, [navigate, basePath, getRecordId]);

  const handleDeleteRecord = useCallback(async (record) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      const id = getRecordId(record);
      await deleteRecord(id);
    }
  }, [deleteRecord, getRecordId]);

  // Pesquisa
  const handleSearch = useCallback((term) => {
    setSearchTerm(term);
    loadData(1, term);
  }, [loadData]);

  // Mudança de página
  const handlePageChange = useCallback((newPage) => {
    loadData(newPage, searchTerm);
  }, [loadData, searchTerm]);

  // Carregar dados iniciais
  useEffect(() => {
    loadData(1, '');
  }, []);

  return {
    // Estado
    data,
    currentRecord,
    loading,
    error,
    pagination,
    searchTerm,
    
    // Ações
    loadData,
    loadRecord,
    createRecord,
    updateRecord,
    deleteRecord,
    
    // Navegação
    handleViewRecord,
    handleCreateRecord,
    handleEditRecord,
    handleDeleteRecord,
    
    // Utilitários
    handleSearch,
    handlePageChange,
    setError,
  };
}

export default useCrud;

