import { useState } from 'react';

interface NFSe {
  numero: string;
  codigoVerificacao: string;
  cliente: string;
  servico: string;
  dataEmissao: string;
  valor: number;
  status: 'Emitida' | 'Cancelada' | 'Rejeitada';
  linkPDF?: string;
}

/**
 * Página de Nota Fiscal de Serviços Eletrônica (NFSe)
 * Gerencia notas fiscais de serviços
 */
function NFSe() {
  const [notas] = useState<NFSe[]>([
    {
      numero: '000001',
      codigoVerificacao: 'ABC123456789',
      cliente: 'Empresa ABC Ltda',
      servico: 'Assessoria em Importação',
      dataEmissao: '2025-11-10',
      valor: 5000.00,
      status: 'Emitida',
      linkPDF: '#',
    },
    {
      numero: '000002',
      codigoVerificacao: 'XYZ987654321',
      cliente: 'XYZ Comércio',
      servico: 'Despacho Aduaneiro',
      dataEmissao: '2025-11-11',
      valor: 3500.00,
      status: 'Emitida',
      linkPDF: '#',
    },
    {
      numero: '000003',
      codigoVerificacao: 'DEF456789123',
      cliente: 'Importadora Sul',
      servico: 'Consultoria Logística',
      dataEmissao: '2025-11-08',
      valor: 12000.00,
      status: 'Rejeitada',
    },
  ]);

  const getStatusColor = (status: NFSe['status']) => {
    switch (status) {
      case 'Emitida':
        return 'bg-green-100 text-green-800';
      case 'Cancelada':
        return 'bg-red-100 text-red-800';
      case 'Rejeitada':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalNotas = notas.length;
  const notasEmitidas = notas.filter((n) => n.status === 'Emitida').length;
  const valorTotal = notas.filter((n) => n.status === 'Emitida').reduce((sum, n) => sum + n.valor, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Nota Fiscal de Serviços Eletrônica (NFSe)</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gerencie notas fiscais de serviços eletrônicas
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Total de NFSe</h3>
              <p className="text-3xl font-bold mt-1">{totalNotas}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </div>
        </div>

        <div className="bg-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Emitidas</h3>
              <p className="text-3xl font-bold mt-1">{notasEmitidas}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
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

      {/* Botão Emitir NFSe */}
      <div className="flex justify-end">
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 font-medium">
          + Emitir NFSe
        </button>
      </div>

      {/* Tabela de NFSe */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Notas Fiscais de Serviços</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código Verificação
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Serviço
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data Emissão
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
              {notas.map((nota) => (
                <tr key={nota.numero} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {nota.numero}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                    {nota.codigoVerificacao}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {nota.cliente}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {nota.servico}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(nota.dataEmissao).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    R$ {nota.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(nota.status)}`}>
                      {nota.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">Ver</button>
                    {nota.linkPDF && (
                      <button className="text-indigo-600 hover:text-indigo-900 mr-3">PDF</button>
                    )}
                    {nota.status === 'Emitida' && (
                      <button className="text-red-600 hover:text-red-900">Cancelar</button>
                    )}
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

export default NFSe;

