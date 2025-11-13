import { useState } from 'react';

interface Contrato {
  id: string;
  numero: string;
  cliente: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  valor: number;
  status: 'Ativo' | 'Encerrado' | 'Pendente' | 'Cancelado';
}

/**
 * Página de Contratos
 * Gerencia contratos de serviços logísticos
 */
function Contrato() {
  const [contratos] = useState<Contrato[]>([
    {
      id: 'CT-001',
      numero: 'CT-2025-001',
      cliente: 'Empresa ABC Ltda',
      tipo: 'Mensal',
      dataInicio: '2025-01-01',
      dataFim: '2025-12-31',
      valor: 15000.00,
      status: 'Ativo',
    },
    {
      id: 'CT-002',
      numero: 'CT-2025-002',
      cliente: 'XYZ Comércio',
      tipo: 'Anual',
      dataInicio: '2025-01-15',
      dataFim: '2025-12-31',
      valor: 120000.00,
      status: 'Ativo',
    },
    {
      id: 'CT-003',
      numero: 'CT-2024-050',
      cliente: 'Importadora Sul',
      tipo: 'Por Projeto',
      dataInicio: '2024-06-01',
      dataFim: '2024-12-31',
      valor: 45000.00,
      status: 'Encerrado',
    },
  ]);

  const getStatusColor = (status: Contrato['status']) => {
    switch (status) {
      case 'Ativo':
        return 'bg-green-100 text-green-800';
      case 'Encerrado':
        return 'bg-gray-100 text-gray-800';
      case 'Pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalContratos = contratos.length;
  const contratosAtivos = contratos.filter((c) => c.status === 'Ativo').length;
  const valorTotal = contratos.filter((c) => c.status === 'Ativo').reduce((sum, c) => sum + c.valor, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Contratos</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gerencie contratos de serviços logísticos
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Total de Contratos</h3>
              <p className="text-3xl font-bold mt-1">{totalContratos}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
        </div>

        <div className="bg-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Contratos Ativos</h3>
              <p className="text-3xl font-bold mt-1">{contratosAtivos}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        <div className="bg-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Valor Total Ativo</h3>
              <p className="text-3xl font-bold mt-1">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Botão Novo Contrato */}
      <div className="flex justify-end">
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 font-medium">
          + Novo Contrato
        </button>
      </div>

      {/* Tabela de Contratos */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Contratos</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Período
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {contratos.map((contrato) => (
                <tr key={contrato.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {contrato.numero}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {contrato.cliente}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {contrato.tipo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>{new Date(contrato.dataInicio).toLocaleDateString('pt-BR')}</div>
                    <div className="text-xs text-gray-400">
                      até {new Date(contrato.dataFim).toLocaleDateString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    R$ {contrato.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(contrato.status)}`}>
                      {contrato.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">Ver</button>
                    <button className="text-indigo-600 hover:text-indigo-900 mr-3">Editar</button>
                    <button className="text-gray-600 hover:text-gray-900">PDF</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Contrato;

