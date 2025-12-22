import { useState, useEffect } from 'react';
import api from '../services/api';
import { authService } from '../services/auth';

function Configuracoes() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  useEffect(() => {
    loadBackupInfo();
  }, []);

  const loadBackupInfo = async () => {
    try {
      setLoadingInfo(true);
      const response = await api.get('/tenant/backup-info/');
      if (response.data.last_backup_at) {
        const date = new Date(response.data.last_backup_at);
        setLastBackup(date.toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }));
      } else {
        setLastBackup(null);
      }
    } catch (err: any) {
      console.error('Erro ao carregar informações do backup:', err);
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleBackup = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Fazer requisição para o endpoint de backup
      const response = await api.post(
        '/tenant/backup/',
        {},
        {
          responseType: 'blob', // Importante para receber arquivo binário
        }
      );

      // Criar um link temporário para download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      // Obter nome do arquivo do header Content-Disposition ou usar padrão
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'backup_tenant.zip';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccess('✅ Backup criado e baixado com sucesso!');
      
      // Recarregar informações do backup
      await loadBackupInfo();
    } catch (err: any) {
      console.error('Erro ao fazer backup:', err);
      if (err.response?.status === 403) {
        setError('Você não tem permissão para fazer backup. Apenas administradores do tenant podem fazer backup.');
      } else {
        setError(err.response?.data?.error || 'Erro ao criar backup. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Configurações</h1>

        {/* Seção de Backup */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Backup do Tenant</h2>
              <p className="text-gray-600 text-sm">
                Faça o download de um backup completo do seu tenant, incluindo todos os dados do schema e informações relacionadas.
              </p>
            </div>
            <div className="ml-4">
              <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">{success}</p>
            </div>
          )}

          {lastBackup && (
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-gray-700 text-sm">
                <strong>Último backup manual:</strong>{' '}
                <span className="text-gray-900 font-medium">{lastBackup}</span>
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800 text-sm mb-2">
              <strong>O que está incluído no backup:</strong>
            </p>
            <ul className="text-blue-700 text-sm list-disc list-inside space-y-1">
              <li>Schema completo do tenant (todas as tabelas e dados)</li>
              <li>Dados públicos relacionados (domínios, assinaturas, pagamentos, etc.)</li>
              <li>Informações do tenant (metadados)</li>
            </ul>
          </div>

          <button
            onClick={handleBackup}
            disabled={loading}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg font-medium transition duration-200 ${
              loading
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Gerando backup...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Fazer Backup do Tenant
              </span>
            )}
          </button>
        </div>

        {/* Outras configurações podem ser adicionadas aqui */}
      </div>
    </div>
  );
}

export default Configuracoes;

