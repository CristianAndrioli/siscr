import { useState } from 'react';

interface CotacaoCambio {
  id: string;
  moeda: string;
  simbolo: string;
  compra: number;
  venda: number;
  variacao: number;
  dataAtualizacao: string;
}

/**
 * Página de Cotação de Câmbio
 * Exibe cotações de moedas estrangeiras
 */
function CotacaoCambio() {
  const [cotacoes] = useState<CotacaoCambio[]>([
    {
      id: 'USD',
      moeda: 'Dólar Americano',
      simbolo: 'USD',
      compra: 5.12,
      venda: 5.15,
      variacao: 0.25,
      dataAtualizacao: '2025-11-13T10:30:00',
    },
    {
      id: 'EUR',
      moeda: 'Euro',
      simbolo: 'EUR',
      compra: 5.58,
      venda: 5.62,
      variacao: -0.15,
      dataAtualizacao: '2025-11-13T10:30:00',
    },
    {
      id: 'GBP',
      moeda: 'Libra Esterlina',
      simbolo: 'GBP',
      compra: 6.45,
      venda: 6.50,
      variacao: 0.10,
      dataAtualizacao: '2025-11-13T10:30:00',
    },
    {
      id: 'JPY',
      moeda: 'Iene Japonês',
      simbolo: 'JPY',
      compra: 0.034,
      venda: 0.035,
      variacao: 0.05,
      dataAtualizacao: '2025-11-13T10:30:00',
    },
    {
      id: 'CNY',
      moeda: 'Yuan Chinês',
      simbolo: 'CNY',
      compra: 0.71,
      venda: 0.72,
      variacao: -0.02,
      dataAtualizacao: '2025-11-13T10:30:00',
    },
    {
      id: 'ARS',
      moeda: 'Peso Argentino',
      simbolo: 'ARS',
      compra: 0.0058,
      venda: 0.0060,
      variacao: 0.10,
      dataAtualizacao: '2025-11-13T10:30:00',
    },
  ]);

  const getVariacaoColor = (variacao: number) => {
    if (variacao > 0) return 'text-green-600';
    if (variacao < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getVariacaoIcon = (variacao: number) => {
    if (variacao > 0) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      );
    }
    if (variacao < 0) {
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Cotação de Câmbio</h1>
        <p className="mt-2 text-sm text-gray-500">
          Acompanhe as cotações de moedas estrangeiras em tempo real
        </p>
      </div>

      {/* Cards de Cotações */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cotacoes.map((cotacao) => (
          <div key={cotacao.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{cotacao.moeda}</h3>
                <p className="text-sm text-gray-500">{cotacao.simbolo}</p>
              </div>
              <div className="text-2xl font-bold text-blue-600">{cotacao.simbolo}</div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Compra</span>
                <span className="text-lg font-semibold text-gray-900">
                  R$ {cotacao.compra.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Venda</span>
                <span className="text-lg font-semibold text-gray-900">
                  R$ {cotacao.venda.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">Variação</span>
                <span className={`text-sm font-semibold flex items-center ${getVariacaoColor(cotacao.variacao)}`}>
                  {getVariacaoIcon(cotacao.variacao)}
                  <span className="ml-1">
                    {cotacao.variacao > 0 ? '+' : ''}{cotacao.variacao.toFixed(2)}%
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Atualizado: {new Date(cotacao.dataAtualizacao).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Informação */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-start">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-blue-600 mt-1 mr-3 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Sobre as Cotações
            </h3>
            <p className="text-sm text-blue-800">
              As cotações são atualizadas regularmente e refletem as taxas de câmbio do mercado.
              Valores de compra e venda podem variar conforme o mercado e condições comerciais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CotacaoCambio;

