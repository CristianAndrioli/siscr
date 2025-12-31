import { useState, useEffect } from 'react';
import { Button, Input, Select, Alert } from '../../components/common';
import { estoqueService, locationsService, type Location } from '../../services/estoque';
import { useForm } from '../../hooks/useForm';

interface TransferenciaForm {
  produto: string;
  location_origem: string;
  location_destino: string;
  quantidade: string;
  observacao: string;
}

/**
 * Página para processar Transferências de Estoque
 */
export function Transferencias() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const initialValues: TransferenciaForm = {
    produto: '',
    location_origem: '',
    location_destino: '',
    quantidade: '',
    observacao: '',
  };

  const { formData, handleChange, setFormData } = useForm(initialValues);

  // Carregar locations ao montar
  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoadingLocations(true);
      const response = await locationsService.list();
      const locationsData = 'results' in response ? response.results : response;
      setLocations(Array.isArray(locationsData) ? locationsData : []);
    } catch (err: any) {
      console.error('Erro ao carregar locations:', err);
      setError('Erro ao carregar locations');
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await estoqueService.processarTransferencia({
        produto: Number(formData.produto),
        location_origem: Number(formData.location_origem),
        location_destino: Number(formData.location_destino),
        quantidade: formData.quantidade,
        observacao: formData.observacao || undefined,
      });

      setSuccess('Transferência processada com sucesso!');
      setFormData(initialValues);
    } catch (err: any) {
      console.error('Erro ao processar transferência:', err);
      setError(err.response?.data?.detail || err.response?.data?.message || 'Erro ao processar transferência');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Transferências de Estoque</h1>
        <p className="mt-2 text-sm text-gray-500">
          Transfira produtos entre locations
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
            <div>
              <Input
                label="ID do Produto *"
                name="produto"
                type="number"
                value={formData.produto}
                onChange={handleChange}
                required
                placeholder="Digite o ID do produto"
              />
            </div>

            <div>
              <Select
                label="Location de Origem *"
                name="location_origem"
                value={formData.location_origem}
                onChange={handleChange}
                required
                options={[
                  { value: '', label: 'Selecione...' },
                  ...locations.map(loc => ({
                    value: loc.id.toString(),
                    label: `${loc.nome} (${loc.codigo})`,
                  })),
                ]}
                disabled={loadingLocations}
              />
            </div>

            <div>
              <Select
                label="Location de Destino *"
                name="location_destino"
                value={formData.location_destino}
                onChange={handleChange}
                required
                options={[
                  { value: '', label: 'Selecione...' },
                  ...locations
                    .filter(loc => loc.id.toString() !== formData.location_origem)
                    .map(loc => ({
                      value: loc.id.toString(),
                      label: `${loc.nome} (${loc.codigo})`,
                    })),
                ]}
                disabled={loadingLocations}
              />
            </div>

            <div>
              <Input
                label="Quantidade *"
                name="quantidade"
                type="number"
                step="0.001"
                min="0.001"
                value={formData.quantidade}
                onChange={handleChange}
                required
                placeholder="0.000"
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Observação"
                name="observacao"
                value={formData.observacao}
                onChange={handleChange}
                placeholder="Observações sobre a transferência"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button
              type="submit"
              variant="primary"
              disabled={loading || loadingLocations}
            >
              {loading ? 'Processando...' : 'Processar Transferência'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Transferencias;

