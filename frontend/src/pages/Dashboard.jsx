import { useState, useEffect } from 'react';
import api from '../services/api';

function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get('/');
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Carregando...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Dashboard</h1>
        <p className="text-gray-600">Bem-vindo ao SISCR!</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Informações da API</h2>
        {data && (
          <div className="space-y-2">
            <p><strong>Mensagem:</strong> {data.message}</p>
            <p><strong>Versão:</strong> {data.version}</p>
            <p><strong>Usuário:</strong> {data.user}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Módulos</h3>
          <p className="text-3xl font-bold">Em desenvolvimento</p>
        </div>
        <div className="bg-green-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Multi-Tenant</h3>
          <p className="text-3xl font-bold">Ativo</p>
        </div>
        <div className="bg-purple-500 text-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">API REST</h3>
          <p className="text-3xl font-bold">Funcionando</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

