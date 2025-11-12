import { useState } from 'react';

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

  const updateDashboard = (data: Shipment[]): DashboardStats => {
    const total = data.length;
    const emTransito = data.filter((s) => s.status === 'Em Trânsito').length;
    const entregues = data.filter((s) => s.status === 'Entregue').length;
    const atrasados = data.filter((s) => s.status === 'Atrasado').length;

    return { total, emTransito, entregues, atrasados };
  };

  const stats = updateDashboard(shipments);

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

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card Total */}
        <div className="bg-blue-600 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
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
        <div className="bg-yellow-500 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
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
        <div className="bg-green-600 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
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
        <div className="bg-red-600 text-white p-6 rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1 cursor-pointer">
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
              {shipments.map((shipment) => (
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

