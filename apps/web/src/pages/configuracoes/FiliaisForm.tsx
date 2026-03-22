import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { filiaisService, type Filial, type FilialCreate, type FilialUpdate } from '../../services/tenants/filiais';
import { empresasService } from '../../services/tenants/empresas';
import { Input, Select, Button, Alert, Checkbox } from '../../components/common';
import { useForm } from '../../hooks/useForm';
import { formatApiError } from '../../utils/helpers';
import { ESTADOS } from '../../utils/constants';

interface EmpresaOption {
  id: number;
  nome: string;
}

function FiliaisForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const editando = !!id && isEditMode;
  
  const initialValues: FilialCreate | FilialUpdate = {
    empresa: 0,
    nome: '',
    codigo_filial: '',
    cnpj: '',
    endereco: '',
    cidade: '',
    estado: 'SC',
    cep: '',
    telefone: '',
    email: '',
    is_active: true,
  };

  const { formData, handleChange, setFormData, resetForm } = useForm(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([]);

  // Carregar empresas
  const carregarEmpresas = useCallback(async () => {
    try {
      const response = await empresasService.list();
      const empresasList = Array.isArray(response) ? response : response.results || [];
      setEmpresas(empresasList.map((emp: any) => ({ id: emp.id, nome: emp.nome })));
    } catch (error) {
      console.error('Erro ao carregar empresas:', error);
      setError('Erro ao carregar empresas');
    }
  }, []);

  const carregarDados = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError('');
      const dados = await filiaisService.get(Number(id));
      
      setFormData({
        empresa: dados.empresa,
        nome: dados.nome,
        codigo_filial: dados.codigo_filial || '',
        cnpj: dados.cnpj || '',
        endereco: dados.endereco || '',
        cidade: dados.cidade || '',
        estado: dados.estado || 'SC',
        cep: dados.cep || '',
        telefone: dados.telefone || '',
        email: dados.email || '',
        is_active: dados.is_active,
      });
    } catch (error) {
      console.error('Erro ao carregar dados da filial:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados da filial';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id, setFormData]);

  useEffect(() => {
    carregarEmpresas();
  }, [carregarEmpresas]);

  useEffect(() => {
    if (editando && id) {
      carregarDados();
    } else if (!editando) {
      resetForm(initialValues);
    }
  }, [editando, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (editando && id) {
        await filiaisService.update(Number(id), formData as FilialUpdate);
      } else {
        await filiaisService.create(formData as FilialCreate);
      }
      navigate('/configuracoes/filiais');
    } catch (err: any) {
      console.error('Erro ao salvar filial:', err);
      const errorMessage = formatApiError(err);
      
      // Verificar se é erro de quota
      if (err.response?.data?.quota_exceeded || err.response?.data?.quota) {
        setError(
          `Limite de filiais atingido: ${err.response.data.quota || err.response.data.detail || 'Você atingiu o limite de filiais do seu plano. Faça upgrade para adicionar mais filiais.'}`
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading && editando && !formData.nome) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados da filial...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          {editando ? 'Editar Filial' : 'Nova Filial'}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {editando ? 'Edite as informações da filial' : 'Preencha os dados para criar uma nova filial'}
        </p>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError('')}
          dismissible
          className="mb-6"
        />
      )}

      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Select
              label="Empresa *"
              name="empresa"
              value={formData.empresa}
              onChange={handleChange}
              required
              options={[
                { value: 0, label: 'Selecione uma empresa' },
                ...empresas.map(emp => ({ value: emp.id, label: emp.nome }))
              ]}
            />
          </div>

          <Input
            label="Nome da Filial *"
            name="nome"
            value={formData.nome}
            onChange={handleChange}
            required
          />

          <Input
            label="Código da Filial"
            name="codigo_filial"
            value={formData.codigo_filial}
            onChange={handleChange}
          />

          <Input
            label="CNPJ"
            name="cnpj"
            value={formData.cnpj}
            onChange={handleChange}
          />

          <Input
            label="CEP"
            name="cep"
            value={formData.cep}
            onChange={handleChange}
          />

          <div className="md:col-span-2">
            <Input
              label="Endereço"
              name="endereco"
              value={formData.endereco}
              onChange={handleChange}
            />
          </div>

          <Input
            label="Cidade"
            name="cidade"
            value={formData.cidade}
            onChange={handleChange}
          />

          <Select
            label="Estado"
            name="estado"
            value={formData.estado}
            onChange={handleChange}
            options={ESTADOS}
          />

          <Input
            label="Telefone"
            name="telefone"
            value={formData.telefone}
            onChange={handleChange}
          />

          <Input
            label="E-mail"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
          />
        </div>

        <div className="flex items-center">
          <Checkbox
            name="is_active"
            checked={formData.is_active}
            onChange={handleChange}
            label="Filial ativa"
          />
        </div>

        <div className="flex justify-end space-x-4 pt-4 border-t">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/configuracoes/filiais')}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={loading || !formData.empresa || !formData.nome}
          >
            {loading ? 'Salvando...' : editando ? 'Atualizar' : 'Criar'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default FiliaisForm;

