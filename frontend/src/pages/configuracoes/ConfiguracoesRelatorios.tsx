import { useState, useEffect } from 'react';
import { Input, Button, Alert, Textarea } from '../../components/common';
import { configService, type ReportConfig, type ReportConfigUpdate } from '../../services/reports/config';
import { formatApiError } from '../../utils/helpers';

/**
 * Componente de Configurações Gerais de Relatórios
 */
export default function ConfiguracoesRelatorios() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [formData, setFormData] = useState<Partial<ReportConfigUpdate>>({
    nome_empresa: '',
    endereco: '',
    telefone: '',
    email: '',
    cnpj: '',
    logo_url: '',
    formato_padrao: 'pdf',
    email_destinatario_padrao: '',
    assunto_padrao: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await configService.get();
      setConfig(data);
      setFormData({
        nome_empresa: data.nome_empresa || '',
        endereco: data.endereco || '',
        telefone: data.telefone || '',
        email: data.email || '',
        cnpj: data.cnpj || '',
        logo_url: data.logo_url || '',
        formato_padrao: data.formato_padrao || 'pdf',
        email_destinatario_padrao: data.email_destinatario_padrao || '',
        assunto_padrao: data.assunto_padrao || '',
      });
      
      if (data.logo_upload) {
        setLogoPreview(data.logo_upload);
      }
    } catch (err: any) {
      console.error('Erro ao carregar configurações:', err);
      // Se não existir, não é erro - será criado ao salvar
      if (err.response?.status !== 404) {
        setError('Erro ao carregar configurações');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData: Partial<ReportConfigUpdate> = { ...formData };
      if (logoFile) {
        updateData.logo_upload = logoFile;
      }

      if (config) {
        await configService.update(config.id, updateData);
        setSuccess('Configurações atualizadas com sucesso!');
      } else {
        await configService.create(updateData);
        setSuccess('Configurações criadas com sucesso!');
      }

      await loadConfig();
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err);
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert type="error" message={error} dismissible onClose={() => setError('')} />
      )}

      {success && (
        <Alert type="success" message={success} dismissible onClose={() => setSuccess('')} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Logo */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Logo
          </label>
          <div className="flex items-start gap-4">
            {logoPreview && (
              <div className="flex-shrink-0">
                <img
                  src={logoPreview}
                  alt="Logo preview"
                  className="h-20 w-auto object-contain border border-gray-300 rounded"
                />
              </div>
            )}
            <div className="flex-1">
              <Input
                type="file"
                name="logo_upload"
                accept="image/*"
                onChange={handleLogoChange}
                helpText="Upload de logo (PNG, JPG, SVG)"
              />
              <Input
                label="Ou URL do Logo"
                name="logo_url"
                value={formData.logo_url || ''}
                onChange={(e) => handleChange('logo_url', e.target.value)}
                placeholder="https://exemplo.com/logo.png"
                className="mt-2"
              />
            </div>
          </div>
        </div>

        {/* Dados da Empresa */}
        <div className="md:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Dados da Empresa</h3>
        </div>

        <Input
          label="Nome da Empresa"
          name="nome_empresa"
          value={formData.nome_empresa || ''}
          onChange={(e) => handleChange('nome_empresa', e.target.value)}
        />

        <Input
          label="CNPJ"
          name="cnpj"
          value={formData.cnpj || ''}
          onChange={(e) => handleChange('cnpj', e.target.value)}
        />

        <Textarea
          label="Endereço"
          name="endereco"
          value={formData.endereco || ''}
          onChange={(e) => handleChange('endereco', e.target.value)}
          rows={2}
        />

        <Input
          label="Telefone"
          name="telefone"
          value={formData.telefone || ''}
          onChange={(e) => handleChange('telefone', e.target.value)}
        />

        <Input
          label="Email"
          name="email"
          type="email"
          value={formData.email || ''}
          onChange={(e) => handleChange('email', e.target.value)}
        />

        {/* Configurações Padrão */}
        <div className="md:col-span-2">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 mt-6">Configurações Padrão</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Formato Padrão
          </label>
          <select
            name="formato_padrao"
            value={formData.formato_padrao || 'pdf'}
            onChange={(e) => handleChange('formato_padrao', e.target.value)}
            className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
          >
            <option value="pdf">PDF</option>
            <option value="html">HTML</option>
            <option value="xlsx">Excel</option>
          </select>
        </div>

        <Input
          label="Email Destinatário Padrão"
          name="email_destinatario_padrao"
          type="email"
          value={formData.email_destinatario_padrao || ''}
          onChange={(e) => handleChange('email_destinatario_padrao', e.target.value)}
          placeholder="relatorios@empresa.com"
        />

        <Input
          label="Assunto Padrão"
          name="assunto_padrao"
          value={formData.assunto_padrao || ''}
          onChange={(e) => handleChange('assunto_padrao', e.target.value)}
          placeholder="Relatório do Sistema"
        />
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="secondary" onClick={loadConfig} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </form>
  );
}

