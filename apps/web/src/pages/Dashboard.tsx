import { useState, useEffect } from 'react';
import { metricsService, type MetricsResponse, type Quota } from '../services/metrics';

interface Shipment {
  id: string;
  client: string;
  origin: string;
  destination: string;
  status: 'Em Trânsito' | 'Entregue' | 'Atrasado';
  estimatedArrival: Date;
}

interface DashboardStats {
  total: number;
  emTransito: number;
  entregues: number;
  atrasados: number;
}

function Dashboard() {
  const [shipments] = useState<Shipment[]>([
    { id: 'PROC-1001', client: 'Empresa A', origin: 'Xangai', destination: 'Santos', status: 'Em Trânsito', estimatedArrival: new Date('2025-11-10') },
    { id: 'PROC-1002', client: 'Empresa B', origin: 'Hamburg', destination: 'Manaus', status: 'Entregue', estimatedArrival: new Date('2025-10-20') },
    { id: 'PROC-1003', client: 'Empresa C', origin: 'Nova Iorque', destination: 'Rio de Janeiro', status: 'Atrasado', estimatedArrival: new Date('2025-10-01') },
    { id: 'PROC-1004', client: 'Empresa D', origin: 'Buenos Aires', destination: 'Porto Alegre', status: 'Em Trânsito', estimatedArrival: new Date('2025-11-25') },
    { id: 'PROC-1005', client: 'Empresa E', origin: 'Tokyo', destination: 'Recife', status: 'Entregue', estimatedArrival: new Date('2025-09-15') },
  ]);

  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>(shipments);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [errorMetrics, setErrorMetrics] = useState<string | null>(null);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        setLoadingMetrics(true);
        const data = await metricsService.getMetrics();
        setMetrics(data);
        setErrorMetrics(null);
      } catch (err: any) {
        console.error('Erro ao carregar métricas:', err);
        setErrorMetrics(err.response?.data?.error || 'Erro ao carregar métricas');
      } finally {
        setLoadingMetrics(false);
      }
    };

    loadMetrics();
  }, []);

  const updateDashboard = (data: Shipment[]): DashboardStats => {
    const total = data.length;
    const emTransito = data.filter((s) => s.status === 'Em Trânsito').length;
    const entregues = data.filter((s) => s.status === 'Entregue').length;
    const atrasados = data.filter((s) => s.status === 'Atrasado').length;

    return { total, emTransito, entregues, atrasados };
  };

  const stats = updateDashboard(shipments);

  const showShipmentsByStatus = (status: Shipment['status'] | null) => {
    if (status === null) {
      setFilteredShipments(shipments);
    } else {
      setFilteredShipments(shipments.filter((s) => s.status === status));
    }
  };

  const getStatusClass = (status: Shipment['status']): string => {
    switch (status) {
      case 'Em Trânsito':
        return 'text-yellow-600 font-semibold';
      case 'Entregue':
        return 'text-green-600 font-semibold';
      case 'Atrasado':
        return 'text-red-600 font-semibold';
      default:
        return 'text-gray-600';
    }
  };

  const getQuotaColor = (quota: Quota): string => {
    if (quota.critical) return 'bg-red-500';
    if (quota.warning) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getQuotaTextColor = (quota: Quota): string => {
    if (quota.critical) return 'text-red-600';
    if (quota.warning) return 'text-yellow-600';
    return 'text-green-600';
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-8">
      {/* Seção de Métricas e Quotas */}
      {metrics && (
        <div className="bg-white p-8 rounded-xl shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Uso e Quotas</h2>
            {metrics.subscription && (
              <div className="text-right">
                <p className="text-sm text-gray-600">Plano Atual</p>
                <p className="text-lg font-semibold text-indigo-600">{metrics.subscription.plan_name}</p>
                {metrics.subscription.is_trial && (
                  <span className="inline-block mt-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded">
                    Trial
                  </span>
                )}
              </div>
            )}
          </div>

          {loadingMetrics ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-gray-600">Carregando métricas...</p>
            </div>
          ) : errorMetrics ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errorMetrics}
            </div>
          ) : metrics.quotas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {metrics.quotas.map((quota) => (
                <div key={quota.type} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold text-gray-800">{quota.name}</h3>
                    <span className={`text-sm font-bold ${getQuotaTextColor(quota)}`}>
                      {quota.percentage}%
                    </span>
                  </div>
                  
                  <div className="mb-2">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>{quota.used} {quota.unit || ''}</span>
                      <span>{quota.limit} {quota.unit || ''}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${getQuotaColor(quota)}`}
                        style={{ width: `${Math.min(100, quota.percentage)}%` }}
                      ></div>
                    </div>
                  </div>

                  {quota.warning && !quota.critical && (
                    <p className="text-xs text-yellow-600 mt-2">
                      ⚠️ Uso próximo do limite ({quota.percentage}%)
                    </p>
                  )}
                  {quota.critical && (
                    <p className="text-xs text-red-600 mt-2">
                      🚨 Limite quase atingido ({quota.percentage}%)
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Nenhuma métrica disponível
            </div>
          )}

          {metrics.subscription && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className={`font-semibold ${
                    metrics.subscription.is_active ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {metrics.subscription.is_active ? 'Ativa' : 'Inativa'}
                  </p>
                </div>
                {metrics.subscription.current_period_end && (
                  <div>
                    <p className="text-gray-600">Próxima Renovação</p>
                    <p className="font-semibold text-gray-800">
                      {formatDate(metrics.subscription.current_period_end)}
                    </p>
                  </div>
                )}
                {metrics.subscription.expires_at && (
                  <div>
                    <p className="text-gray-600">Expira em</p>
                    <p className="font-semibold text-gray-800">
                      {formatDate(metrics.subscription.expires_at)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards de Estatísticas de Movimentações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card Total */}
        <div 
          onClick={() => showShipmentsByStatus(null)}
          className="bg-blue-600 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Total de Envios</h3>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 2a10 10 0 0 0-9.95 8.95A10 10 0 0 0 10 22.95V12"></path>
            </svg>
          </div>
        </div>

        {/* Card Em Trânsito */}
        <div 
          onClick={() => showShipmentsByStatus('Em Trânsito')}
          className="bg-yellow-500 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Em Trânsito</h3>
              <p className="text-3xl font-bold mt-1">{stats.emTransito}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
          </div>
        </div>

        {/* Card Entregues */}
        <div 
          onClick={() => showShipmentsByStatus('Entregue')}
          className="bg-green-600 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Entregues</h3>
              <p className="text-3xl font-bold mt-1">{stats.entregues}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
        </div>

        {/* Card Atrasados */}
        <div 
          onClick={() => showShipmentsByStatus('Atrasado')}
          className="bg-red-600 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold opacity-80">Atrasados</h3>
              <p className="text-3xl font-bold mt-1">{stats.atrasados}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
        </div>
      </div>

      {/* Tabela de Movimentações */}
      <div className="bg-white p-8 rounded-xl shadow-2xl mt-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b-2 border-gray-200 pb-2">Movimentações Recentes</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full leading-normal">
            <thead>
              <tr className="bg-gray-100 text-gray-600 uppercase text-sm leading-normal">
                <th className="py-3 px-6 text-left">Processo</th>
                <th className="py-3 px-6 text-left">Cliente</th>
                <th className="py-3 px-6 text-left">Origem</th>
                <th className="py-3 px-6 text-left">Destino</th>
                <th className="py-3 px-6 text-left">Status</th>
                <th className="py-3 px-6 text-left">Previsão Entrega</th>
              </tr>
            </thead>
            <tbody className="text-gray-600 text-sm font-light">
              {filteredShipments.map((shipment) => (
                <tr key={shipment.id} className="border-b border-gray-200 hover:bg-gray-100">
                  <td className="py-3 px-6 whitespace-nowrap">{shipment.id}</td>
                  <td className="py-3 px-6 whitespace-nowrap">{shipment.client}</td>
                  <td className="py-3 px-6 whitespace-nowrap">{shipment.origin}</td>
                  <td className="py-3 px-6 whitespace-nowrap">{shipment.destination}</td>
                  <td className={`py-3 px-6 whitespace-nowrap ${getStatusClass(shipment.status)}`}>
                    {shipment.status}
                  </td>
                  <td className="py-3 px-6 whitespace-nowrap">
                    {shipment.estimatedArrival.toLocaleDateString('pt-BR')}
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

export default Dashboard;

