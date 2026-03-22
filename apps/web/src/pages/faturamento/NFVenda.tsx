import { useState } from 'react';

interface NFVenda {
  numero: string;
  serie: string;
  cliente: string;
  dataEmissao: string;
  dataVencimento: string;
  valor: number;
  status: 'Emitida' | 'Cancelada' | 'Inutilizada';
  chaveAcesso?: string;
}

/**
 * Página de Nota Fiscal de Venda
 * Gerencia notas fiscais de venda
 */
function NFVenda() {
  const [notas] = useState<NFVenda[]>([
    {
      numero: '000001',
      serie: '1',
      cliente: 'Empresa ABC Ltda',
      dataEmissao: '2025-11-10',
      dataVencimento: '2025-12-10',
      valor: 15000.00,
      status: 'Emitida',
      chaveAcesso: '35210512345678000125550010000000011234567890',
    },
    {
      numero: '000002',
      serie: '1',
      cliente: 'XYZ Comércio',
      dataEmissao: '2025-11-11',
      dataVencimento: '2025-12-11',
      valor: 8500.00,
      status: 'Emitida',
      chaveAcesso: '35210512345678000125550010000000021234567890',
    },
    {
      numero: '000003',
      serie: '1',
      cliente: 'Importadora Sul',
      dataEmissao: '2025-11-05',
      dataVencimento: '2025-12-05',
      valor: 25000.00,
      status: 'Cancelada',
    },
  ]);

  const getStatusColor = (status: NFVenda['status']) => {
    switch (status) {
      case 'Emitida':
        return 'bg-green-100 text-green-800';
      case 'Cancelada':
        return 'bg-red-100 text-red-800';
      case 'Inutilizada':
        return 'bg-gray-100 text-gray-800';
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
        <h1 className="text-3xl font-bold text-gray-900">Nota Fiscal de Venda</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gerencie notas fiscais de venda e emissão de documentos fiscais
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Total de Notas</h3>
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

      {/* Botão Emitir NF */}
      <div className="flex justify-end">
        <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 font-medium">
          + Emitir Nota Fiscal
        </button>
      </div>

      {/* Tabela de Notas Fiscais */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Notas Fiscais</h2>
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
                  Data Emissão
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vencimento
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
                <tr key={`${nota.numero}-${nota.serie}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {nota.numero}/{nota.serie}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {nota.cliente}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(nota.dataEmissao).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(nota.dataVencimento).toLocaleDateString('pt-BR')}
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
                    <button className="text-indigo-600 hover:text-indigo-900 mr-3">Imprimir</button>
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

export default NFVenda;

