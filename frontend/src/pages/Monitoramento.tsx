import { useState } from 'react';

interface Processo {
  id: string;
  numero: string;
  cliente: string;
  tipo: string;
  status: 'Em Andamento' | 'Concluído' | 'Aguardando' | 'Cancelado';
  etapaAtual: string;
  progresso: number;
  dataInicio: string;
  previsaoConclusao: string;
}

/**
 * Página de Monitoramento
 * Monitora processos e operações logísticas
 */
function Monitoramento() {
  const [processos] = useState<Processo[]>([
    {
      id: 'PROC-001',
      numero: 'PROC-2025-001',
      cliente: 'Empresa ABC Ltda',
      tipo: 'Importação',
      status: 'Em Andamento',
      etapaAtual: 'Despacho Aduaneiro',
      progresso: 65,
      dataInicio: '2025-11-01',
      previsaoConclusao: '2025-11-20',
    },
    {
      id: 'PROC-002',
      numero: 'PROC-2025-002',
      cliente: 'XYZ Comércio',
      tipo: 'Exportação',
      status: 'Aguardando',
      etapaAtual: 'Aguardando Documentação',
      progresso: 30,
      dataInicio: '2025-11-05',
      previsaoConclusao: '2025-11-25',
    },
    {
      id: 'PROC-003',
      numero: 'PROC-2025-003',
      cliente: 'Importadora Sul',
      tipo: 'Importação',
      status: 'Concluído',
      etapaAtual: 'Entregue',
      progresso: 100,
      dataInicio: '2025-10-15',
      previsaoConclusao: '2025-11-10',
    },
  ]);

  const getStatusColor = (status: Processo['status']) => {
    switch (status) {
      case 'Em Andamento':
        return 'bg-blue-100 text-blue-800';
      case 'Concluído':
        return 'bg-green-100 text-green-800';
      case 'Aguardando':
        return 'bg-yellow-100 text-yellow-800';
      case 'Cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (progresso: number) => {
    if (progresso >= 75) return 'bg-green-600';
    if (progresso >= 50) return 'bg-blue-600';
    if (progresso >= 25) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const totalProcessos = processos.length;
  const processosAndamento = processos.filter((p) => p.status === 'Em Andamento').length;
  const processosConcluidos = processos.filter((p) => p.status === 'Concluído').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Monitoramento</h1>
        <p className="mt-2 text-sm text-gray-500">
          Acompanhe o status e progresso de processos e operações logísticas
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Total de Processos</h3>
              <p className="text-3xl font-bold mt-1">{totalProcessos}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
          </div>
        </div>

        <div className="bg-yellow-500 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Em Andamento</h3>
              <p className="text-3xl font-bold mt-1">{processosAndamento}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
        </div>

        <div className="bg-green-600 text-white p-6 rounded-xl shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Concluídos</h3>
              <p className="text-3xl font-bold mt-1">{processosConcluidos}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>
      </div>

      {/* Lista de Processos */}
      <div className="space-y-4">
        {processos.map((processo) => (
          <div key={processo.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{processo.numero}</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(processo.status)}`}>
                    {processo.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{processo.cliente}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Tipo: {processo.tipo} | Etapa Atual: {processo.etapaAtual}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Início</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(processo.dataInicio).toLocaleDateString('pt-BR')}
                </p>
                <p className="text-sm text-gray-500 mt-2">Previsão</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(processo.previsaoConclusao).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Progresso</span>
                <span className="text-sm font-semibold text-gray-900">{processo.progresso}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all duration-300 ${getProgressColor(processo.progresso)}`}
                  style={{ width: `${processo.progresso}%` }}
                ></div>
              </div>
            </div>

            {/* Ações */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">Ver Detalhes</button>
              <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">Histórico</button>
              <button className="text-gray-600 hover:text-gray-900 text-sm font-medium">Documentos</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Monitoramento;

