import { useState, useEffect } from 'react';
import { Button, Select, Input, Alert, LoadingSpinner } from '../../components/common';
import { relatoriosService, locationsService, type Location } from '../../services/estoque';
import { empresasService } from '../../services/tenants/empresas';
import { filiaisService } from '../../services/tenants/filiais';

interface RelatorioParams {
  tipo: 'estoque-por-location' | 'estoque-consolidado' | 'movimentacoes' | 'reservas' | 'indicadores';
  location?: string;
  empresa?: string;
  filial?: string;
  data_inicio?: string;
  data_fim?: string;
}

interface Empresa {
  id: number;
  nome: string;
}

interface Filial {
  id: number;
  nome: string;
  empresa: number;
}

/**
 * Página de Relatórios de Estoque
 */
export function RelatorioEstoque() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [locations, setLocations] = useState<Location[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [relatorioData, setRelatorioData] = useState<any>(null);

  const [filters, setFilters] = useState<RelatorioParams>({
    tipo: 'estoque-por-location',
    location: '',
    empresa: '',
    filial: '',
    data_inicio: '',
    data_fim: '',
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [locationsRes, empresasRes] = await Promise.all([
        locationsService.list(),
        empresasService.list(),
      ]);

      const locationsData = 'results' in locationsRes ? locationsRes.results : locationsRes;
      const empresasData = 'results' in empresasRes ? empresasRes.results : empresasRes;

      setLocations(Array.isArray(locationsData) ? locationsData : []);
      setEmpresas(Array.isArray(empresasData) ? empresasData : []);
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados iniciais');
    }
  };

  const loadFiliais = async (empresaId: number) => {
    try {
      const response = await filiaisService.list({ empresa: empresaId });
      const filiaisData = 'results' in response ? response.results : response;
      setFiliais(Array.isArray(filiaisData) ? filiaisData : []);
    } catch (err: any) {
      console.error('Erro ao carregar filiais:', err);
    }
  };

  const handleFilterChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
    if (name === 'empresa' && value) {
      loadFiliais(Number(value));
    }
  };

  const handleGerarRelatorio = async () => {
    setLoading(true);
    setError('');
    setRelatorioData(null);

    try {
      const params: any = {};
      if (filters.location) params.location = Number(filters.location);
      if (filters.empresa) params.empresa = Number(filters.empresa);
      if (filters.filial) params.filial = Number(filters.filial);
      if (filters.data_inicio) params.data_inicio = filters.data_inicio;
      if (filters.data_fim) params.data_fim = filters.data_fim;

      let data;
      switch (filters.tipo) {
        case 'estoque-por-location':
          data = await relatoriosService.estoquePorLocation(params);
          break;
        case 'estoque-consolidado':
          data = await relatoriosService.estoqueConsolidado(params);
          break;
        case 'movimentacoes':
          data = await relatoriosService.movimentacoes(params);
          break;
        case 'reservas':
          data = await relatoriosService.reservas(params);
          break;
        case 'indicadores':
          data = await relatoriosService.indicadores(params);
          break;
      }

      setRelatorioData(data);
    } catch (err: any) {
      console.error('Erro ao gerar relatório:', err);
      setError(err.response?.data?.detail || err.response?.data?.message || 'Erro ao gerar relatório');
    } finally {
      setLoading(false);
    }
  };

  const handleExportar = async (formato: 'xlsx' | 'pdf' | 'csv') => {
    try {
      const params: any = { formato };
      if (filters.location) params.location = Number(filters.location);
      if (filters.empresa) params.empresa = Number(filters.empresa);
      if (filters.filial) params.filial = Number(filters.filial);
      if (filters.data_inicio) params.data_inicio = filters.data_inicio;
      if (filters.data_fim) params.data_fim = filters.data_fim;

      const blob = await relatoriosService.exportar(params);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-estoque.${formato}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Erro ao exportar relatório:', err);
      setError('Erro ao exportar relatório');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Relatórios de Estoque</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gere relatórios detalhados sobre estoque, movimentações, reservas e indicadores
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

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Filtros do Relatório</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Select
              label="Tipo de Relatório *"
              name="tipo"
              value={filters.tipo}
              onChange={(e) => handleFilterChange('tipo', e.target.value)}
              options={[
                { value: 'estoque-por-location', label: 'Estoque por Location' },
                { value: 'estoque-consolidado', label: 'Estoque Consolidado' },
                { value: 'movimentacoes', label: 'Movimentações' },
                { value: 'reservas', label: 'Reservas' },
                { value: 'indicadores', label: 'Indicadores' },
              ]}
            />
          </div>

          <div>
            <Select
              label="Empresa"
              name="empresa"
              value={filters.empresa}
              onChange={(e) => handleFilterChange('empresa', e.target.value)}
              options={[
                { value: '', label: 'Todas' },
                ...empresas.map(emp => ({
                  value: emp.id.toString(),
                  label: emp.nome,
                })),
              ]}
            />
          </div>

          <div>
            <Select
              label="Filial"
              name="filial"
              value={filters.filial}
              onChange={(e) => handleFilterChange('filial', e.target.value)}
              disabled={!filters.empresa}
              options={[
                { value: '', label: 'Todas' },
                ...filiais
                  .filter(f => !filters.empresa || f.empresa === Number(filters.empresa))
                  .map(fil => ({
                    value: fil.id.toString(),
                    label: fil.nome,
                  })),
              ]}
            />
          </div>

          <div>
            <Select
              label="Location"
              name="location"
              value={filters.location}
              onChange={(e) => handleFilterChange('location', e.target.value)}
              options={[
                { value: '', label: 'Todas' },
                ...locations.map(loc => ({
                  value: loc.id.toString(),
                  label: `${loc.nome} (${loc.codigo})`,
                })),
              ]}
            />
          </div>

          <div>
            <Input
              label="Data Início"
              name="data_inicio"
              type="date"
              value={filters.data_inicio}
              onChange={(e) => handleFilterChange('data_inicio', e.target.value)}
            />
          </div>

          <div>
            <Input
              label="Data Fim"
              name="data_fim"
              type="date"
              value={filters.data_fim}
              onChange={(e) => handleFilterChange('data_fim', e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-6 pt-4 border-t">
          <Button
            onClick={handleGerarRelatorio}
            variant="primary"
            disabled={loading}
          >
            {loading ? 'Gerando...' : 'Gerar Relatório'}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      )}

      {relatorioData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">Resultado do Relatório</h2>
            <div className="flex space-x-2">
              <Button
                onClick={() => handleExportar('xlsx')}
                variant="secondary"
                size="sm"
              >
                Exportar XLSX
              </Button>
              <Button
                onClick={() => handleExportar('pdf')}
                variant="secondary"
                size="sm"
              >
                Exportar PDF
              </Button>
              <Button
                onClick={() => handleExportar('csv')}
                variant="secondary"
                size="sm"
              >
                Exportar CSV
              </Button>
            </div>
          </div>
          <pre className="bg-gray-50 p-4 rounded overflow-auto max-h-96 text-sm">
            {JSON.stringify(relatorioData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default RelatorioEstoque;

