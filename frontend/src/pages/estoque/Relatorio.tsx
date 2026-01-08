import { useState, useEffect } from 'react';
import { Button, Select, Input, Modal, Alert, LoadingSpinner, Checkbox } from '../../components/common';
import { generatorService, type GerarRelatorioRequest } from '../../services/reports/generator';
import { templatesService, type ReportTemplate } from '../../services/reports/templates';
import { locationsService, type Location } from '../../services/estoque';
import { formatApiError } from '../../utils/helpers';

interface RelatorioTipo {
  tipo: string;
  nome: string;
  descricao?: string;
}

/**
 * Página de geração de relatórios de Estoque
 * Filtra automaticamente apenas templates do módulo "estoque"
 */
export default function RelatorioEstoque() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);

  const [formData, setFormData] = useState<Partial<GerarRelatorioRequest>>({
    tipo: '',
    modulo: 'estoque', // Fixo para estoque
    formato: 'pdf',
    template_id: null,
    filtros: {},
    enviar_email: false,
    email_destinatario: null,
  });

  // Tipos de relatórios disponíveis para estoque
  const tiposRelatorios: RelatorioTipo[] = [
    {
      tipo: 'estoque-por-location',
      nome: 'Estoque por Location',
      descricao: 'Relatório detalhado de estoque agrupado por location',
    },
    {
      tipo: 'estoque-consolidado',
      nome: 'Estoque Consolidado',
      descricao: 'Relatório consolidado de estoque por produto',
    },
  ];

  // Carregar locations e templates
  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (formData.tipo) {
      loadTemplates();
    }
  }, [formData.tipo]);

  const loadLocations = async () => {
    try {
      const response = await locationsService.list();
      const locationsData = 'results' in response ? response.results : response;
      setLocations(Array.isArray(locationsData) ? locationsData : []);
    } catch (err) {
      console.error('Erro ao carregar locations:', err);
    }
  };

  const loadTemplates = async () => {
    if (!formData.tipo) {
      setTemplates([]);
      return;
    }

    try {
      setLoadingTemplates(true);
      const response = await templatesService.list({
        modulo: 'estoque', // Sempre filtrar por estoque
        tipo: formData.tipo,
      });
      const templatesList = Array.isArray(response) ? response : response.results || [];
      setTemplates(templatesList);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleChange = (name: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Se mudou tipo, recarregar templates
      if (name === 'tipo' && newData.tipo) {
        setTimeout(() => loadTemplates(), 100);
      }
      
      return newData;
    });
  };

  const handleFiltroChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      filtros: {
        ...prev.filtros,
        [key]: value,
      },
    }));
  };

  const handleGerar = async (preview: boolean = false) => {
    if (!formData.tipo) {
      setError('Selecione um tipo de relatório');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const requestData: GerarRelatorioRequest = {
        tipo: formData.tipo!,
        modulo: 'estoque', // Sempre estoque
        formato: preview ? 'html' : (formData.formato || 'pdf'),
        template_id: formData.template_id || null,
        filtros: formData.filtros || {},
        enviar_email: formData.enviar_email || false,
        email_destinatario: formData.email_destinatario || null,
      };

      if (preview) {
        // Preview HTML
        const response = await generatorService.gerar(requestData);
        if (typeof response === 'object' && 'html' in response) {
          setPreviewHtml(response.html);
          setShowPreview(true);
        }
      } else {
        // Gerar e baixar
        const response = await generatorService.gerar(requestData);
        if (response instanceof Blob) {
          // Download do PDF
          const url = window.URL.createObjectURL(response);
          const a = document.createElement('a');
          a.href = url;
          a.download = `relatorio_${formData.tipo}_${new Date().getTime()}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          setSuccess('Relatório gerado e baixado com sucesso!');
        }
      }
    } catch (err: any) {
      console.error('Erro ao gerar relatório:', err);
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const tipoSelecionado = tiposRelatorios.find(
    t => t.tipo === formData.tipo
  );
  
  // Verificar se há um tipo válido selecionado
  const tipoValido = formData.tipo && formData.tipo.trim() !== '' && tipoSelecionado;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Relatórios de Estoque</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gere relatórios personalizados do módulo de estoque
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} dismissible onClose={() => setError('')} />
      )}

      {success && (
        <Alert type="success" message={success} dismissible onClose={() => setSuccess('')} />
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Gerar Relatório</h2>

        <div className="space-y-4">
          {/* Seleção de Tipo */}
          <div>
            <Select
              label="Tipo de Relatório *"
              name="tipo"
              value={formData.tipo || ''}
              onChange={(e) => handleChange('tipo', e.target.value)}
              required
              options={[
                { value: '', label: 'Selecione um tipo...' },
                ...tiposRelatorios.map(t => ({
                  value: t.tipo,
                  label: t.nome,
                })),
              ]}
            />
          </div>

          {tipoSelecionado && tipoSelecionado.descricao && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">{tipoSelecionado.descricao}</p>
            </div>
          )}

          {/* Template Customizado */}
          {formData.tipo && (
            <div>
              <Select
                label="Template (Opcional)"
                name="template_id"
                value={formData.template_id?.toString() || ''}
                onChange={(e) => handleChange('template_id', e.target.value ? parseInt(e.target.value) : null)}
                options={[
                  { value: '', label: 'Usar template padrão' },
                  ...templates.map(t => ({
                    value: t.id.toString(),
                    label: `${t.nome}${t.is_default ? ' (Padrão)' : ''}`,
                  })),
                ]}
                disabled={loadingTemplates}
              />
              {loadingTemplates && (
                <p className="text-sm text-gray-500 mt-1">Carregando templates...</p>
              )}
            </div>
          )}

          {/* Filtros */}
          {formData.tipo === 'estoque-por-location' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Filtros</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Location (Opcional)"
                  name="location_id"
                  value={formData.filtros?.location_id?.toString() || ''}
                  onChange={(e) => handleFiltroChange('location_id', e.target.value ? parseInt(e.target.value) : null)}
                  options={[
                    { value: '', label: 'Todas as locations' },
                    ...locations.map(loc => ({
                      value: loc.id.toString(),
                      label: `${loc.nome}${loc.codigo ? ` (${loc.codigo})` : ''}`,
                    })),
                  ]}
                />

                <Input
                  label="Código do Produto (Opcional)"
                  name="produto_id"
                  type="text"
                  value={formData.filtros?.produto_id || ''}
                  onChange={(e) => handleFiltroChange('produto_id', e.target.value || null)}
                  placeholder="Ex: PROD001"
                />
              </div>
            </div>
          )}

          {formData.tipo === 'estoque-consolidado' && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Filtros</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Código do Produto (Opcional)"
                  name="produto_id"
                  type="text"
                  value={formData.filtros?.produto_id || ''}
                  onChange={(e) => handleFiltroChange('produto_id', e.target.value || null)}
                  placeholder="Ex: PROD001"
                />
              </div>
            </div>
          )}

          {/* Formato */}
          <div>
            <Select
              label="Formato *"
              name="formato"
              value={formData.formato || 'pdf'}
              onChange={(e) => handleChange('formato', e.target.value)}
              required
              options={[
                { value: 'pdf', label: 'PDF' },
                { value: 'html', label: 'HTML' },
              ]}
            />
          </div>

          {/* Email (Opcional) */}
          <div className="border-t pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Envio por Email (Opcional)</h3>
            <div className="space-y-4">
              <Checkbox
                label="Enviar por Email"
                name="enviar_email"
                checked={formData.enviar_email || false}
                onChange={(e) => handleChange('enviar_email', e.target.checked)}
              />

              {formData.enviar_email && (
                <Input
                  label="Email Destinatário"
                  name="email_destinatario"
                  type="email"
                  value={formData.email_destinatario || ''}
                  onChange={(e) => handleChange('email_destinatario', e.target.value)}
                  placeholder="exemplo@empresa.com"
                />
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="primary"
              onClick={() => handleGerar(false)}
              disabled={loading || !tipoValido}
            >
              {loading ? 'Gerando...' : 'Gerar e Baixar'}
            </Button>

            <Button
              variant="secondary"
              onClick={() => handleGerar(true)}
              disabled={loading || !tipoValido}
            >
              Preview HTML
            </Button>
          </div>
          
        </div>
      </div>

      {/* Modal de Preview */}
      {showPreview && (
        <Modal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          title="Preview do Relatório"
          size="xl"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowPreview(false)}>
                Fechar
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setShowPreview(false);
                  handleGerar(false);
                }}
              >
                Gerar PDF
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {previewHtml ? (
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <iframe
                  srcDoc={previewHtml}
                  title="Preview do Relatório"
                  className="w-full"
                  style={{ height: '600px', border: 'none' }}
                  sandbox="allow-same-origin allow-scripts"
                />
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <LoadingSpinner />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
