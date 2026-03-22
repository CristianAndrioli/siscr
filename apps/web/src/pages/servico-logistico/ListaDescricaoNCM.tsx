import { useState, useEffect } from 'react';
import api from '../../services/api';

interface NCMItem {
  codigo: string;
  descricao: string;
  ex?: string;
  tipo?: string;
}

/**
 * Página de Lista de Descrição NCM
 * Permite buscar e consultar códigos NCM (Nomenclatura Comum do Mercosul)
 */
function ListaDescricaoNCM() {
  const [searchTerm, setSearchTerm] = useState('');
  const [ncmList, setNcmList] = useState<NCMItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Dados mockados de exemplo (em produção, viria da API)
  const mockNCMData: NCMItem[] = [
    { codigo: '0101.21.00', descricao: 'Cavalos, reprodutores de raça pura', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0101.29.00', descricao: 'Outros cavalos vivos', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0102.21.00', descricao: 'Bovinos reprodutores de raça pura', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0102.29.00', descricao: 'Outros bovinos vivos', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0103.91.00', descricao: 'Suínos reprodutores de raça pura', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0103.92.00', descricao: 'Outros suínos vivos', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0104.10.00', descricao: 'Ovinos vivos, reprodutores de raça pura', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0104.20.00', descricao: 'Outros ovinos vivos', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0105.11.00', descricao: 'Galinhas, reprodutoras de raça pura', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0105.12.00', descricao: 'Outras galinhas', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0105.94.00', descricao: 'Perus vivos', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0106.19.00', descricao: 'Outros animais vivos', ex: '1', tipo: 'Animais vivos' },
    { codigo: '0201.10.00', descricao: 'Carnes de bovinos, frescas ou refrigeradas', ex: '1', tipo: 'Carnes' },
    { codigo: '0201.20.00', descricao: 'Carnes de bovinos, congeladas', ex: '1', tipo: 'Carnes' },
    { codigo: '0202.10.00', descricao: 'Carnes de suínos, frescas ou refrigeradas', ex: '1', tipo: 'Carnes' },
    { codigo: '0202.20.00', descricao: 'Carnes de suínos, congeladas', ex: '1', tipo: 'Carnes' },
    { codigo: '0203.11.00', descricao: 'Carnes de suínos, frescas ou refrigeradas', ex: '1', tipo: 'Carnes' },
    { codigo: '0203.12.00', descricao: 'Carnes de suínos, congeladas', ex: '1', tipo: 'Carnes' },
    { codigo: '0204.10.00', descricao: 'Carnes de ovinos ou caprinos, frescas ou refrigeradas', ex: '1', tipo: 'Carnes' },
    { codigo: '0204.21.00', descricao: 'Carnes de ovinos ou caprinos, congeladas', ex: '1', tipo: 'Carnes' },
    { codigo: '0204.22.00', descricao: 'Carnes de caprinos, congeladas', ex: '1', tipo: 'Carnes' },
    { codigo: '0207.11.00', descricao: 'Carnes e miudezas comestíveis de galinhas, frescas ou refrigeradas', ex: '1', tipo: 'Carnes' },
    { codigo: '0207.12.00', descricao: 'Carnes e miudezas comestíveis de galinhas, congeladas', ex: '1', tipo: 'Carnes' },
    { codigo: '0207.13.00', descricao: 'Carnes e miudezas comestíveis de perus, frescas ou refrigeradas', ex: '1', tipo: 'Carnes' },
    { codigo: '0207.14.00', descricao: 'Carnes e miudezas comestíveis de perus, congeladas', ex: '1', tipo: 'Carnes' },
    { codigo: '0301.11.00', descricao: 'Trutas vivas', ex: '1', tipo: 'Peixes' },
    { codigo: '0301.19.00', descricao: 'Outros peixes vivos', ex: '1', tipo: 'Peixes' },
    { codigo: '0302.11.00', descricao: 'Trutas, frescas ou refrigeradas', ex: '1', tipo: 'Peixes' },
    { codigo: '0302.12.00', descricao: 'Salmões do Pacífico, frescos ou refrigerados', ex: '1', tipo: 'Peixes' },
    { codigo: '0302.13.00', descricao: 'Salmões do Atlântico e salmões do Danúbio, frescos ou refrigerados', ex: '1', tipo: 'Peixes' },
    { codigo: '0302.19.00', descricao: 'Outros peixes, frescos ou refrigerados', ex: '1', tipo: 'Peixes' },
    { codigo: '0303.11.00', descricao: 'Atuns, congelados', ex: '1', tipo: 'Peixes' },
    { codigo: '0303.12.00', descricao: 'Salmões, congelados', ex: '1', tipo: 'Peixes' },
    { codigo: '0303.19.00', descricao: 'Outros peixes, congelados', ex: '1', tipo: 'Peixes' },
    { codigo: '0401.10.00', descricao: 'Leite e nata, não concentrados nem adicionados de açúcar', ex: '1', tipo: 'Laticínios' },
    { codigo: '0401.20.00', descricao: 'Leite e nata, não concentrados, adicionados de açúcar', ex: '1', tipo: 'Laticínios' },
    { codigo: '0402.10.00', descricao: 'Leite e nata, concentrados, não adicionados de açúcar', ex: '1', tipo: 'Laticínios' },
    { codigo: '0402.21.00', descricao: 'Leite e nata, concentrados, adicionados de açúcar', ex: '1', tipo: 'Laticínios' },
    { codigo: '0402.29.00', descricao: 'Outros leites e natas, concentrados, adicionados de açúcar', ex: '1', tipo: 'Laticínios' },
    { codigo: '0403.10.00', descricao: 'Iogurte', ex: '1', tipo: 'Laticínios' },
    { codigo: '0403.90.00', descricao: 'Outros laticínios', ex: '1', tipo: 'Laticínios' },
    { codigo: '0404.10.00', descricao: 'Soro de leite', ex: '1', tipo: 'Laticínios' },
    { codigo: '0404.90.00', descricao: 'Outros produtos do leite', ex: '1', tipo: 'Laticínios' },
    { codigo: '0405.10.00', descricao: 'Manteiga', ex: '1', tipo: 'Laticínios' },
    { codigo: '0405.20.00', descricao: 'Preparações à base de manteiga', ex: '1', tipo: 'Laticínios' },
    { codigo: '0405.90.00', descricao: 'Outros produtos lácteos', ex: '1', tipo: 'Laticínios' },
    { codigo: '0406.10.00', descricao: 'Queijos frescos', ex: '1', tipo: 'Laticínios' },
    { codigo: '0406.20.00', descricao: 'Queijos ralados ou em pó', ex: '1', tipo: 'Laticínios' },
    { codigo: '0406.30.00', descricao: 'Queijos processados', ex: '1', tipo: 'Laticínios' },
    { codigo: '0406.40.00', descricao: 'Queijos azuis', ex: '1', tipo: 'Laticínios' },
    { codigo: '0406.90.00', descricao: 'Outros queijos', ex: '1', tipo: 'Laticínios' },
    { codigo: '0407.00.00', descricao: 'Ovos de aves, com casca, frescos ou conservados', ex: '1', tipo: 'Ovos' },
    { codigo: '0408.11.00', descricao: 'Gemas de ovos, secas', ex: '1', tipo: 'Ovos' },
    { codigo: '0408.19.00', descricao: 'Outras gemas de ovos', ex: '1', tipo: 'Ovos' },
    { codigo: '0408.91.00', descricao: 'Ovos de aves, sem casca, secos', ex: '1', tipo: 'Ovos' },
    { codigo: '0408.99.00', descricao: 'Outros ovos de aves, sem casca', ex: '1', tipo: 'Ovos' },
    { codigo: '0409.00.00', descricao: 'Mel natural', ex: '1', tipo: 'Produtos apícolas' },
    { codigo: '0410.00.00', descricao: 'Outros produtos comestíveis de origem animal', ex: '1', tipo: 'Produtos animais' },
  ];

  useEffect(() => {
    // Carregar dados iniciais
    loadNCMData();
  }, []);

  const loadNCMData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Tentar buscar da API
      try {
        const response = await api.get('/ncm/');
        setNcmList(response.data);
      } catch (apiError) {
        // Se não houver endpoint, usar dados mockados
        setNcmList(mockNCMData);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados NCM';
      setError(errorMessage);
      // Em caso de erro, usar dados mockados
      setNcmList(mockNCMData);
    } finally {
      setLoading(false);
    }
  };

  const filteredNCM = ncmList.filter((item) => {
    const search = searchTerm.toLowerCase();
    return (
      item.codigo.toLowerCase().includes(search) ||
      item.descricao.toLowerCase().includes(search) ||
      (item.tipo && item.tipo.toLowerCase().includes(search))
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Lista de Descrição NCM</h1>
        <p className="mt-2 text-sm text-gray-500">
          Consulte e gerencie códigos NCM (Nomenclatura Comum do Mercosul)
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Busca */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Buscar por código NCM, descrição ou tipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tabela de Resultados */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Resultados ({filteredNCM.length})
          </h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código NCM
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Descrição
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ex
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredNCM.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      Nenhum resultado encontrado
                    </td>
                  </tr>
                ) : (
                  filteredNCM.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.codigo}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.descricao}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.ex || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.tipo || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
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
              Sobre o NCM
            </h3>
            <p className="text-sm text-blue-800">
              A Nomenclatura Comum do Mercosul (NCM) é um código de oito dígitos utilizado para
              classificar mercadorias no comércio exterior. Os primeiros seis dígitos correspondem
              ao Sistema Harmonizado (SH) e os dois últimos são específicos do Mercosul.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListaDescricaoNCM;

