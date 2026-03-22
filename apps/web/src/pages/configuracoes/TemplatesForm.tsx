import { useState, useEffect } from 'react';
import { Input, Select, Button, Checkbox, Modal, Alert, Textarea } from '../../components/common';
import { templatesService, type ReportTemplate, type ReportTemplateCreate } from '../../services/reports/templates';
import { formatApiError } from '../../utils/helpers';
import CodeEditor from '../../components/common/CodeEditor';
import ReportPreview from '../../components/reports/ReportPreview';

interface TemplatesFormProps {
  template: ReportTemplate | null;
  onClose: () => void;
  onSave: () => void;
}

/**
 * Formulário de criação/edição de templates de relatórios
 */
export default function TemplatesForm({ template, onClose, onSave }: TemplatesFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState<Partial<ReportTemplateCreate>>({
    nome: '',
    codigo: '',
    descricao: '',
    modulo: 'estoque',
    tipo_relatorio: '',
    template_customizado: false,
    template_arquivo: '',
    template_html: '',
    template_css: '',
    incluir_logo: true,
    incluir_dados_empresa: true,
    orientacao: 'portrait',
    is_active: true,
    is_default: false,
  });

  useEffect(() => {
    if (template) {
      setFormData({
        nome: template.nome,
        codigo: template.codigo,
        descricao: template.descricao || '',
        modulo: template.modulo,
        tipo_relatorio: template.tipo_relatorio,
        template_customizado: template.template_customizado,
        template_arquivo: template.template_arquivo || '',
        template_html: template.template_html || '',
        template_css: template.template_css || '',
        incluir_logo: template.incluir_logo,
        incluir_dados_empresa: template.incluir_dados_empresa,
        orientacao: template.orientacao,
        is_active: template.is_active,
        is_default: template.is_default,
      });
    }
  }, [template]);

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (template) {
        await templatesService.update(template.id, formData);
        setSuccess('Template atualizado com sucesso!');
      } else {
        await templatesService.create(formData as ReportTemplateCreate);
        setSuccess('Template criado com sucesso!');
      }

      setTimeout(() => {
        onSave();
      }, 1000);
    } catch (err: any) {
      console.error('Erro ao salvar template:', err);
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={template ? 'Editar Template' : 'Novo Template'}
      size={showPreview ? "xl" : "xl"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert type="error" message={error} dismissible onClose={() => setError('')} />
        )}

        {success && (
          <Alert type="success" message={success} dismissible onClose={() => setSuccess('')} />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Nome *"
            name="nome"
            value={formData.nome || ''}
            onChange={(e) => handleChange('nome', e.target.value)}
            required
          />

          <Input
            label="Código *"
            name="codigo"
            value={formData.codigo || ''}
            onChange={(e) => handleChange('codigo', e.target.value)}
            required
            placeholder="ex: estoque-por-location"
            helpText="Código único do template (sem espaços)"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Módulo *"
            name="modulo"
            value={formData.modulo || ''}
            onChange={(e) => handleChange('modulo', e.target.value)}
            required
            options={[
              { value: 'estoque', label: 'Estoque' },
              { value: 'faturamento', label: 'Faturamento' },
              { value: 'cadastros', label: 'Cadastros' },
            ]}
          />

          <Input
            label="Tipo de Relatório *"
            name="tipo_relatorio"
            value={formData.tipo_relatorio || ''}
            onChange={(e) => handleChange('tipo_relatorio', e.target.value)}
            required
            placeholder="ex: estoque-por-location"
          />
        </div>

        <Textarea
          label="Descrição"
          name="descricao"
          value={formData.descricao || ''}
          onChange={(e) => handleChange('descricao', e.target.value)}
          rows={3}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Orientação"
            name="orientacao"
            value={formData.orientacao || 'portrait'}
            onChange={(e) => handleChange('orientacao', e.target.value)}
            options={[
              { value: 'portrait', label: 'Retrato' },
              { value: 'landscape', label: 'Paisagem' },
            ]}
          />

          <div className="space-y-2">
            <Checkbox
              label="Template Customizado"
              name="template_customizado"
              checked={formData.template_customizado || false}
              onChange={(e) => handleChange('template_customizado', e.target.checked)}
              helpText="Se marcado, usa template_html do banco. Se não, busca arquivo padrão."
            />
          </div>
        </div>

        {formData.template_customizado && (
          <>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                HTML do Template *
              </label>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? 'Ocultar Preview' : 'Mostrar Preview'}
              </Button>
            </div>
            
            {showPreview && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <ReportPreview
                  tipo={formData.tipo_relatorio || 'preview'}
                  modulo={formData.modulo}
                  templateId={template?.id}
                  templateHtml={formData.template_html}
                  templateCss={formData.template_css}
                  onClose={() => setShowPreview(false)}
                />
              </div>
            )}

            <div>
              <CodeEditor
                language="html"
                value={formData.template_html || ''}
                onChange={(value) => handleChange('template_html', value)}
                height="300px"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CSS Customizado
              </label>
              <CodeEditor
                language="css"
                value={formData.template_css || ''}
                onChange={(value) => handleChange('template_css', value)}
                height="200px"
              />
            </div>
          </>
        )}

        {!formData.template_customizado && (
          <Input
            label="Arquivo do Template"
            name="template_arquivo"
            value={formData.template_arquivo || ''}
            onChange={(e) => handleChange('template_arquivo', e.target.value)}
            placeholder="ex: reports/modules/estoque/estoque_por_location.html"
            helpText="Caminho do arquivo template padrão"
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Checkbox
            label="Incluir Logo"
            name="incluir_logo"
            checked={formData.incluir_logo ?? true}
            onChange={(e) => handleChange('incluir_logo', e.target.checked)}
          />

          <Checkbox
            label="Incluir Dados da Empresa"
            name="incluir_dados_empresa"
            checked={formData.incluir_dados_empresa ?? true}
            onChange={(e) => handleChange('incluir_dados_empresa', e.target.checked)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Checkbox
            label="Ativo"
            name="is_active"
            checked={formData.is_active ?? true}
            onChange={(e) => handleChange('is_active', e.target.checked)}
          />

          <Checkbox
            label="Template Padrão"
            name="is_default"
            checked={formData.is_default || false}
            onChange={(e) => handleChange('is_default', e.target.checked)}
            helpText="Template padrão para este tipo de relatório"
          />
        </div>
      </form>
    </Modal>
  );
}

