import { useState } from 'react';

interface Cotacao {
  id: string;
  cliente: string;
  origem: string;
  destino: string;
  tipoCarga: string;
  peso: number;
  volume: number;
  valor: number;
  prazo: number;
  status: 'Pendente' | 'Aprovada' | 'Rejeitada' | 'Cancelada';
  dataCriacao: string;
}

/**
 * Página de Cotações/Análise Frete
 * Permite criar, visualizar e gerenciar cotações de frete
 */
function Cotacoes() {
  const [cotacoes] = useState<Cotacao[]>([
    {
      id: 'COT-001',
      cliente: 'Empresa ABC Ltda',
      origem: 'São Paulo - SP',
      destino: 'Rio de Janeiro - RJ',
      tipoCarga: 'Geral',
      peso: 1500,
      volume: 5.2,
      valor: 2500.00,
      prazo: 3,
      status: 'Aprovada',
      dataCriacao: '2025-11-10',
    },
    {
      id: 'COT-002',
      cliente: 'XYZ Comércio',
      origem: 'Belo Horizonte - MG',
      destino: 'Curitiba - PR',
      tipoCarga: 'Fragil',
      peso: 800,
      volume: 3.5,
      valor: 1800.00,
      prazo: 5,
      status: 'Pendente',
      dataCriacao: '2025-11-12',
    },
    {
      id: 'COT-003',
      cliente: 'Importadora Sul',
      origem: 'Porto de Santos - SP',
      destino: 'Porto Alegre - RS',
      tipoCarga: 'Container',
      peso: 10000,
      volume: 33.0,
      valor: 8500.00,
      prazo: 7,
      status: 'Aprovada',
      dataCriacao: '2025-11-08',
    },
  ]);

  const getStatusColor = (status: Cotacao['status']) => {
    switch (status) {
      case 'Aprovada':
        return 'bg-green-100 text-green-800';
      case 'Pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'Rejeitada':
        return 'bg-red-100 text-red-800';
      case 'Cancelada':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalCotacoes = cotacoes.length;
  const cotacoesAprovadas = cotacoes.filter((c) => c.status === 'Aprovada').length;
  const cotacoesPendentes = cotacoes.filter((c) => c.status === 'Pendente').length;
  const valorTotal = cotacoes.reduce((sum, c) => sum + c.valor, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cotações/Análise Frete</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gerencie cotações de frete e análises de custos logísticos
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Total de Cotações</h3>
              <p className="text-3xl font-bold mt-1">{totalCotacoes}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
        </div>

        <div className="bg-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Aprovadas</h3>
              <p className="text-3xl font-bold mt-1">{cotacoesAprovadas}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        <div className="bg-yellow-500 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Pendentes</h3>
              <p className="text-3xl font-bold mt-1">{cotacoesPendentes}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
        </div>

        <div className="bg-purple-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Valor Total</h3>
              <p className="text-3xl font-bold mt-1">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Botão Nova Cotação */}
      <div className="flex justify-end">
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 font-medium">
          + Nova Cotação
        </button>
      </div>

      {/* Tabela de Cotações */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Cotações Recentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Origem → Destino
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Peso/Volume
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prazo
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
              {cotacoes.map((cotacao) => (
                <tr key={cotacao.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {cotacao.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {cotacao.cliente}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>{cotacao.origem}</div>
                    <div className="text-xs text-gray-400">→ {cotacao.destino}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cotacao.tipoCarga}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cotacao.peso} kg / {cotacao.volume} m³
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    R$ {cotacao.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {cotacao.prazo} dias
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(cotacao.status)}`}>
                      {cotacao.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">Ver</button>
                    <button className="text-indigo-600 hover:text-indigo-900">Editar</button>
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

export default Cotacoes;

