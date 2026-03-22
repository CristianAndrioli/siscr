import { useState, useEffect } from 'react';
import { Input, Select, Button, Alert, Checkbox } from '../../components/common';
import { emailService, type EmailSettings, type EmailSettingsCreate } from '../../services/email';
import { useForm } from '../../hooks/useForm';

export function EmailSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  
  const initialValues: EmailSettingsCreate = {
    backend: 'console',
    host: '',
    port: 587,
    use_tls: true,
    use_ssl: false,
    username: '',
    password: '',
    from_email: 'SISCR <noreply@siscr.com.br>',
    is_active: true,
  };

  const { formData, handleChange, setFormData } = useForm(initialValues);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const settings = await emailService.getActive();
      if (settings) {
        setFormData({
          backend: settings.backend,
          host: settings.host || '',
          port: settings.port,
          use_tls: settings.use_tls,
          use_ssl: settings.use_ssl,
          username: settings.username || '',
          password: '', // Não carregar senha
          from_email: settings.from_email,
          is_active: settings.is_active,
        });
      }
    } catch (err: any) {
      console.error('Erro ao carregar configurações:', err);
      // Se não houver configuração, usar valores padrão
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
      const activeSettings = await emailService.getActive();
      if (activeSettings) {
        await emailService.update(activeSettings.id, formData);
      } else {
        await emailService.create(formData);
      }
      setSuccess('Configurações de email salvas com sucesso!');
      await loadSettings();
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err);
      setError(err.response?.data?.detail || err.response?.data?.message || 'Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      setTestResult({ success: false, error: 'Digite um email para testar' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await emailService.testEmail({ to_email: testEmail });
      setTestResult(result);
      if (result.success) {
        setSuccess(result.message || 'Email de teste enviado com sucesso!');
      } else {
        setError(result.error || 'Erro ao enviar email de teste');
      }
    } catch (err: any) {
      console.error('Erro ao testar email:', err);
      setTestResult({
        success: false,
        error: err.response?.data?.error || err.response?.data?.detail || 'Erro ao enviar email de teste',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Configurações de Email</h1>
        <p className="mt-2 text-sm text-gray-500">
          Configure o servidor SMTP para envio de emails do sistema
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
                label="Backend de Email *"
                name="backend"
                value={formData.backend}
                onChange={handleChange}
                required
                options={[
                  { value: 'console', label: 'Console (Desenvolvimento)' },
                  { value: 'smtp', label: 'SMTP' },
                  { value: 'file', label: 'Arquivo' },
                ]}
              />
            </div>

            {formData.backend === 'smtp' && (
              <>
                <Input
                  label="Servidor SMTP (Host) *"
                  name="host"
                  value={formData.host}
                  onChange={handleChange}
                  required={formData.backend === 'smtp'}
                  placeholder="smtp.gmail.com"
                />

                <Input
                  label="Porta *"
                  name="port"
                  type="number"
                  value={formData.port}
                  onChange={handleChange}
                  required={formData.backend === 'smtp'}
                />

                <div className="md:col-span-2 flex gap-4">
                  <Checkbox
                    name="use_tls"
                    checked={formData.use_tls}
                    onChange={handleChange}
                    label="Usar TLS"
                  />
                  <Checkbox
                    name="use_ssl"
                    checked={formData.use_ssl}
                    onChange={handleChange}
                    label="Usar SSL"
                  />
                </div>

                <Input
                  label="Usuário/Email *"
                  name="username"
                  type="email"
                  value={formData.username}
                  onChange={handleChange}
                  required={formData.backend === 'smtp'}
                  placeholder="seu-email@gmail.com"
                />

                <Input
                  label="Senha *"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required={formData.backend === 'smtp'}
                  placeholder="Senha ou App Password"
                />
              </>
            )}

            <div className="md:col-span-2">
              <Input
                label="Email Remetente *"
                name="from_email"
                value={formData.from_email}
                onChange={handleChange}
                required
                placeholder="SISCR <noreply@siscr.com.br>"
                helpText="Formato: Nome <email@dominio.com>"
              />
            </div>

            <div className="md:col-span-2">
              <Checkbox
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
                label="Configuração ativa"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </form>
      </div>

      {/* Seção de Teste */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Testar Envio de Email</h2>
        <p className="text-sm text-gray-600 mb-4">
          Envie um email de teste para verificar se as configurações estão funcionando corretamente.
        </p>

        <div className="flex gap-4">
          <div className="flex-1">
            <Input
              label="Email de Destino"
              name="test_email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleTestEmail}
              variant="secondary"
              disabled={testing || !testEmail}
            >
              {testing ? 'Enviando...' : 'Enviar Teste'}
            </Button>
          </div>
        </div>

        {testResult && (
          <div className={`mt-4 p-4 rounded-lg ${
            testResult.success
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {testResult.success ? (
              <div>
                <p className="font-semibold">✓ {testResult.message}</p>
                {testResult.settings_used && (
                  <div className="mt-2 text-sm">
                    <p>Backend: {testResult.settings_used.backend}</p>
                    <p>Servidor: {testResult.settings_used.host || 'N/A'}</p>
                    <p>Porta: {testResult.settings_used.port}</p>
                    <p>Remetente: {testResult.settings_used.from_email}</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="font-semibold">✗ Erro ao enviar email</p>
                <p className="text-sm mt-1">{testResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default EmailSettingsPage;

