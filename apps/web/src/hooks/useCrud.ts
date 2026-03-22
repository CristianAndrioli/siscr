import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CrudService, ApiResponse, Pagination, EntityType } from '../types';

interface UseCrudConfig<T extends EntityType> {
  service: CrudService<T>;
  basePath: string;
  getRecordId?: (record: T) => number | string;
}

interface UseCrudReturn<T extends EntityType> {
  // Estado
  data: T[];
  currentRecord: T | null;
  loading: boolean;
  error: string;
  pagination: Pagination;
  searchTerm: string;
  
  // Ações
  loadData: (page?: number, search?: string) => Promise<void>;
  loadRecord: (id: number | string) => Promise<T | null>;
  createRecord: (formData: Partial<T>) => Promise<T>;
  updateRecord: (id: number | string, formData: Partial<T>) => Promise<T>;
  deleteRecord: (id: number | string) => Promise<void>;
  
  // Navegação
  handleViewRecord: (record: T) => void;
  handleCreateRecord: () => void;
  handleEditRecord: (record: T) => void;
  handleDeleteRecord: (record: T | number | string) => Promise<void>;
  
  // Utilitários
  handleSearch: (term: string) => void;
  handlePageChange: (newPage: number) => void;
  setError: React.Dispatch<React.SetStateAction<string>>;
}

/**
 * Hook customizado para gerenciar operações CRUD
 */
export function useCrud<T extends EntityType>({
  service,
  basePath,
  getRecordId = (record) => {
    if ('codigo_cadastro' in record) return (record as { codigo_cadastro: number }).codigo_cadastro;
    if ('codigo_produto' in record) return (record as { codigo_produto: number }).codigo_produto;
    if ('codigo_servico' in record) return (record as { codigo_servico: number }).codigo_servico;
    if ('id' in record) return (record as { id: number | string }).id;
    throw new Error('Não foi possível determinar o ID do registro');
  },
}: UseCrudConfig<T>): UseCrudReturn<T> {
  const navigate = useNavigate();
  
  const [data, setData] = useState<T[]>([]);
  const [currentRecord, setCurrentRecord] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  // Listar registros
  const loadData = useCallback(async (page = 1, search = ''): Promise<void> => {
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
      } else if ('results' in response && Array.isArray(response.results)) {
        // Paginação do Django REST Framework
        const apiResponse = response as ApiResponse<T>;
        setData(apiResponse.results || []);
        setPagination({
          page,
          pageSize: pagination.pageSize,
          total: apiResponse.count || apiResponse.results?.length || 0,
        });
      } else {
        setData([]);
        setPagination({
          page,
          pageSize: pagination.pageSize,
          total: 0,
        });
      }
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Erro ao carregar dados');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [service, pagination.pageSize]);

  // Carregar um registro específico
  const loadRecord = useCallback(async (id: number | string): Promise<T | null> => {
    try {
      setLoading(true);
      setError('');
      const record = await service.get(id);
      setCurrentRecord(record);
      return record;
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError.response?.data?.message || 'Erro ao carregar registro');
      return null;
    } finally {
      setLoading(false);
    }
  }, [service]);

  // Criar registro
  const createRecord = useCallback(async (formData: Partial<T>): Promise<T> => {
    try {
      setLoading(true);
      setError('');
      const newRecord = await service.create(formData);
      await loadData(pagination.page, searchTerm);
      return newRecord;
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string; detail?: string } } };
      const errorMessage = axiosError.response?.data?.message || axiosError.response?.data?.detail || 'Erro ao criar registro';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [service, loadData, pagination.page, searchTerm]);

  // Atualizar registro
  const updateRecord = useCallback(async (id: number | string, formData: Partial<T>): Promise<T> => {
    try {
      setLoading(true);
      setError('');
      const updatedRecord = await service.update(id, formData);
      await loadData(pagination.page, searchTerm);
      setCurrentRecord(updatedRecord);
      return updatedRecord;
    } catch (err) {
      const axiosError = err as { response?: { data?: { message?: string; detail?: string } } };
      const errorMessage = axiosError.response?.data?.message || axiosError.response?.data?.detail || 'Erro ao atualizar registro';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [service, loadData, pagination.page, searchTerm]);

  // Deletar registro
  const deleteRecord = useCallback(async (id: number | string): Promise<void> => {
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
      const axiosError = err as { response?: { data?: { message?: string; detail?: string } } };
      const errorMessage = axiosError.response?.data?.message || axiosError.response?.data?.detail || 'Erro ao deletar registro';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [service, loadData, pagination.page, searchTerm, currentRecord, getRecordId, navigate, basePath]);

  // Navegação
  const handleViewRecord = useCallback((record: T): void => {
    const id = getRecordId(record);
    navigate(`${basePath}/${id}`);
  }, [navigate, basePath, getRecordId]);

  const handleCreateRecord = useCallback((): void => {
    navigate(`${basePath}/novo`);
  }, [navigate, basePath]);

  const handleEditRecord = useCallback((record: T): void => {
    const id = getRecordId(record);
    navigate(`${basePath}/${id}`);
  }, [navigate, basePath, getRecordId]);

  const handleDeleteRecord = useCallback(async (record: T | number | string): Promise<void> => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      const id = typeof record === 'object' ? getRecordId(record) : record;
      await deleteRecord(id);
    }
  }, [deleteRecord, getRecordId]);

  // Pesquisa
  const handleSearch = useCallback((term: string): void => {
    setSearchTerm(term);
    loadData(1, term);
  }, [loadData]);

  // Mudança de página
  const handlePageChange = useCallback((newPage: number): void => {
    loadData(newPage, searchTerm);
  }, [loadData, searchTerm]);

  // Carregar dados iniciais
  useEffect(() => {
    loadData(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

