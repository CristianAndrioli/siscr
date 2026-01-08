import { useState } from 'react';
import { useCrud } from '../../hooks/useCrud';
import { DataGrid, ErrorMessage, LoadingSpinner } from '../../components/common';
import { templatesService, type ReportTemplate } from '../../services/reports/templates';
import { useNavigate } from 'react-router-dom';
import { useGridColumns } from '../../hooks/useGridColumns';
import Button from '../../components/common/Button';
import TemplatesForm from './TemplatesForm';
import ConfiguracoesRelatorios from './ConfiguracoesRelatorios';

/**
 * Página de Configuração de Relatórios
 */
export default function Relatorios() {
  const navigate = useNavigate();
  const [showTemplatesForm, setShowTemplatesForm] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [moduloFilter, setModuloFilter] = useState<string>('');

  const {
    data,
    loading,
    error,
    pagination,
    handleViewRecord,
    handleCreateRecord,
    handleEditRecord,
    handleDeleteRecord,
    handleSearch,
    handlePageChange,
    loadData,
  } = useCrud<ReportTemplate>({
    service: templatesService,
    basePath: '/configuracoes/relatorios/templates',
    getRecordId: (record) => record.id,
  });

  // Filtrar por módulo se necessário
  const filteredData = moduloFilter
    ? data.filter((item) => item.modulo === moduloFilter)
    : data;

  const columns = useGridColumns(filteredData, {
    autoConfig: {
      hiddenFields: ['template_html', 'template_css', 'variaveis_disponiveis', 'created_at', 'updated_at'],
      fieldOverrides: {
        id: {
          label: 'ID',
          required: true,
          width: 80,
        },
        nome: {
          label: 'Nome',
          width: 200,
        },
        codigo: {
          label: 'Código',
          width: 150,
        },
        modulo: {
          label: 'Módulo',
          width: 120,
        },
        tipo_relatorio: {
          label: 'Tipo',
          width: 180,
        },
        template_customizado: {
          label: 'Customizado',
          width: 100,
          render: (value) => (
            value ? (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                Sim
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                Padrão
              </span>
            )
          ),
        },
        is_active: {
          label: 'Ativo',
          width: 80,
          render: (value) => (
            value ? (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                Sim
              </span>
            ) : (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                Não
              </span>
            )
          ),
        },
        is_default: {
          label: 'Padrão',
          width: 80,
          render: (value) => (
            value ? (
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                Sim
              </span>
            ) : null
          ),
        },
        orientacao: {
          label: 'Orientação',
          width: 100,
          render: (value) => (
            <span className="text-sm">
              {value === 'landscape' ? 'Paisagem' : 'Retrato'}
            </span>
          ),
        },
      },
    },
  });

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setShowTemplatesForm(true);
  };

  const handleEditTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setShowTemplatesForm(true);
  };

  const handleCloseForm = () => {
    setShowTemplatesForm(false);
    setSelectedTemplate(null);
    loadData();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configuração de Relatórios</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gerencie templates de relatórios e configurações gerais
        </p>
      </div>

      {error && (
        <ErrorMessage message={error} />
      )}

      {/* Abas */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setShowConfig(false)}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                !showConfig
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Templates
            </button>
            <button
              onClick={() => setShowConfig(true)}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                showConfig
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Configurações Gerais
            </button>
          </nav>
        </div>

        <div className="p-6">
          {!showConfig ? (
            <>
              {/* Filtros */}
              <div className="mb-4 flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Filtrar por Módulo
                  </label>
                  <select
                    value={moduloFilter}
                    onChange={(e) => setModuloFilter(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                  >
                    <option value="">Todos os módulos</option>
                    <option value="estoque">Estoque</option>
                    <option value="faturamento">Faturamento</option>
                    <option value="cadastros">Cadastros</option>
                  </select>
                </div>
                <Button
                  onClick={handleCreateTemplate}
                  variant="primary"
                >
                  Novo Template
                </Button>
              </div>

              {/* Grid de Templates */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <DataGrid
                  data={filteredData}
                  columns={columns}
                  onRowClick={handleEditTemplate}
                  onEdit={handleEditTemplate}
                  onDelete={handleDeleteRecord}
                  onCreate={handleCreateTemplate}
                  onSearch={handleSearch}
                  loading={loading}
                  pagination={pagination ? {
                    ...pagination,
                    onPageChange: handlePageChange,
                  } : undefined}
                  searchPlaceholder="Pesquisar templates..."
                  emptyMessage="Nenhum template encontrado"
                  gridId="report-templates"
                  showActions={true}
                />
              )}
            </>
          ) : (
            <ConfiguracoesRelatorios />
          )}
        </div>
      </div>

      {/* Modal de Formulário de Template */}
      {showTemplatesForm && (
        <TemplatesForm
          template={selectedTemplate}
          onClose={handleCloseForm}
          onSave={handleCloseForm}
        />
      )}
    </div>
  );
}
