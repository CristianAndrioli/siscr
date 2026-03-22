import { useState, useEffect } from 'react';
import { Input, Select, Button, Alert, Checkbox } from '../../components/common';
import { configuracoesService, type ConfiguracaoEstoque } from '../../services/estoque';
import { empresasService } from '../../services/tenants/empresas';
import { useForm } from '../../hooks/useForm';

interface ConfiguracaoForm {
  empresa: string;
  cancelamento_nf_entrada_devolve_estoque: boolean;
  cancelamento_nf_saida_retorna_estoque: boolean;
  tratamento_custo_devolucao: 'MANTER_ORIGINAL' | 'USAR_CUSTO_ATUAL' | 'ZERAR';
}

interface Empresa {
  id: number;
  nome: string;
}

/**
 * Página de Configurações de Estoque
 */
export function ConfiguracoesEstoque() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [configuracaoAtual, setConfiguracaoAtual] = useState<ConfiguracaoEstoque | null>(null);

  const initialValues: ConfiguracaoForm = {
    empresa: '',
    cancelamento_nf_entrada_devolve_estoque: true,
    cancelamento_nf_saida_retorna_estoque: true,
    tratamento_custo_devolucao: 'MANTER_ORIGINAL',
  };

  const { formData, handleChange, setFormData } = useForm(initialValues);

  useEffect(() => {
    loadEmpresas();
  }, []);

  useEffect(() => {
    if (formData.empresa) {
      loadConfiguracao(Number(formData.empresa));
    }
  }, [formData.empresa]);

  const loadEmpresas = async () => {
    try {
      const response = await empresasService.list();
      const empresasData = 'results' in response ? response.results : response;
      setEmpresas(Array.isArray(empresasData) ? empresasData : []);
    } catch (err: any) {
      console.error('Erro ao carregar empresas:', err);
      setError('Erro ao carregar empresas');
    }
  };

  const loadConfiguracao = async (empresaId: number) => {
    try {
      setLoading(true);
      const config = await configuracoesService.getByEmpresa(empresaId);
      if (config) {
        setConfiguracaoAtual(config);
        setFormData({
          empresa: empresaId.toString(),
          cancelamento_nf_entrada_devolve_estoque: config.cancelamento_nf_entrada_devolve_estoque,
          cancelamento_nf_saida_retorna_estoque: config.cancelamento_nf_saida_retorna_estoque,
          tratamento_custo_devolucao: config.tratamento_custo_devolucao,
        });
      } else {
        setConfiguracaoAtual(null);
        setFormData({
          ...initialValues,
          empresa: empresaId.toString(),
        });
      }
    } catch (err: any) {
      console.error('Erro ao carregar configuração:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const data = {
        empresa: Number(formData.empresa),
        cancelamento_nf_entrada_devolve_estoque: formData.cancelamento_nf_entrada_devolve_estoque,
        cancelamento_nf_saida_retorna_estoque: formData.cancelamento_nf_saida_retorna_estoque,
        tratamento_custo_devolucao: formData.tratamento_custo_devolucao,
      };

      if (configuracaoAtual) {
        await configuracoesService.update(configuracaoAtual.id, data);
        setSuccess('Configurações atualizadas com sucesso!');
      } else {
        await configuracoesService.create(data);
        setSuccess('Configurações criadas com sucesso!');
      }

      await loadConfiguracao(Number(formData.empresa));
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err);
      setError(err.response?.data?.detail || err.response?.data?.message || 'Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações de Estoque</h1>
        <p className="mt-2 text-sm text-gray-500">
          Configure o comportamento do estoque para cancelamentos e devoluções de notas fiscais
        </p>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          onClose={() => setError('')}
          dismissible
        />
      )}

      {success && (
        <Alert
          type="success"
          message={success}
          onClose={() => setSuccess('')}
          dismissible
        />
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <Select
                label="Empresa *"
                name="empresa"
                value={formData.empresa}
                onChange={handleChange}
                required
                options={[
                  { value: '', label: 'Selecione uma empresa...' },
                  ...empresas.map(emp => ({
                    value: emp.id.toString(),
                    label: emp.nome,
                  })),
                ]}
              />
            </div>

            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Cancelamento de Nota Fiscal</h3>
            </div>

            <div className="md:col-span-2">
              <Checkbox
                name="cancelamento_nf_entrada_devolve_estoque"
                checked={formData.cancelamento_nf_entrada_devolve_estoque}
                onChange={handleChange}
                label="Cancelamento de NF de Entrada devolve estoque automaticamente"
              />
            </div>

            <div className="md:col-span-2">
              <Checkbox
                name="cancelamento_nf_saida_retorna_estoque"
                checked={formData.cancelamento_nf_saida_retorna_estoque}
                onChange={handleChange}
                label="Cancelamento de NF de Saída retorna estoque automaticamente"
              />
            </div>

            <div className="md:col-span-2">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 mt-4">Tratamento de Custo em Devolução</h3>
            </div>

            <div className="md:col-span-2">
              <Select
                label="Tratamento de Custo em Devolução *"
                name="tratamento_custo_devolucao"
                value={formData.tratamento_custo_devolucao}
                onChange={handleChange}
                required
                options={[
                  { value: 'MANTER_ORIGINAL', label: 'Manter Custo Original' },
                  { value: 'USAR_CUSTO_ATUAL', label: 'Usar Custo Atual do Produto' },
                  { value: 'ZERAR', label: 'Zerar Custo (R$ 0,00)' },
                ]}
              />
              <p className="mt-1 text-sm text-gray-500">
                Define como o custo será tratado quando houver devolução de produtos ao estoque
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !formData.empresa}
            >
              {loading ? 'Salvando...' : configuracaoAtual ? 'Atualizar Configurações' : 'Criar Configurações'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ConfiguracoesEstoque;

