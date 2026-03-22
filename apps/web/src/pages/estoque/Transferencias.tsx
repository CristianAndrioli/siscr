import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataGrid } from '../../components/common';
import { transferenciasService, type Transferencia } from '../../services/estoque/transferencias';
import { useGridColumns } from '../../hooks/useGridColumns';
import AdicionarTransferenciaModal from '../../components/estoque/AdicionarTransferenciaModal';
import Button from '../../components/common/Button';

/**
 * Página de listagem de Transferências de Estoque
 */
export function Transferencias() {
  const navigate = useNavigate();
  const [modalAberto, setModalAberto] = useState(false);
  const [data, setData] = useState<Transferencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  const loadData = async (page = 1, search = '') => {
    try {
      setLoading(true);
      setError('');
      
      const response = await transferenciasService.list({
        page,
        pageSize: pagination.pageSize,
        search,
      });
      
      if (Array.isArray(response)) {
        setData(response);
        setPagination(prev => ({ ...prev, page, total: response.length }));
      } else if ('results' in response && Array.isArray(response.results)) {
        setData(response.results || []);
        setPagination({
          page,
          pageSize: pagination.pageSize,
          total: response.count || response.results?.length || 0,
        });
      } else {
        setData([]);
        setPagination(prev => ({ ...prev, page, total: 0 }));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar transferências');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(pagination.page, searchTerm);
  }, [pagination.page]);

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    loadData(1, term);
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleViewRecord = (record: Transferencia) => {
    // Navegar para detalhes da transferência
    navigate(`/estoque/transferencias/${record.id}`);
  };

  const columns = useGridColumns(data, {
    autoConfig: {
      hiddenFields: ['id', 'produto_id', 'location_origem_id', 'location_destino_id', 'movimentacao_saida_id', 'movimentacao_entrada_id'],
      fieldOverrides: {
        produto_nome: {
          label: 'Produto',
          width: 200,
        },
        produto_codigo: {
          label: 'Código',
          width: 100,
        },
        location_origem_nome: {
          label: 'Origem',
          width: 180,
          render: (value, record) => {
            const codigo = (record as Transferencia).location_origem_codigo;
            return codigo ? `${value} (${codigo})` : value || '-';
          },
        },
        location_destino_nome: {
          label: 'Destino',
          width: 180,
          render: (value, record) => {
            const codigo = (record as Transferencia).location_destino_codigo;
            return codigo ? `${value} (${codigo})` : value || '-';
          },
        },
        quantidade: {
          label: 'Quantidade',
          width: 120,
          render: (value) => {
            if (value === null || value === undefined) return '0';
            return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
          },
        },
        valor_unitario: {
          label: 'Valor Unitário',
          width: 130,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        valor_total: {
          label: 'Valor Total',
          width: 130,
          render: (value) => {
            if (value === null || value === undefined) return '-';
            return new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(Number(value));
          },
        },
        documento_referencia: {
          label: 'Documento',
          width: 150,
          render: (value) => value || '-',
        },
        data_movimentacao: {
          label: 'Data',
          width: 150,
          render: (value) => {
            if (!value) return '-';
            return new Date(value).toLocaleString('pt-BR');
          },
        },
        created_at: {
          label: 'Criado em',
          width: 150,
          render: (value) => {
            if (!value) return '-';
            return new Date(value).toLocaleString('pt-BR');
          },
        },
      },
    },
  });

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transferências de Estoque</h1>
          <p className="mt-2 text-sm text-gray-500">
            Histórico de transferências de produtos entre locations
          </p>
        </div>
        <Button onClick={() => setModalAberto(true)}>
          + Adicionar Transferência
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <DataGrid<Transferencia>
        data={data}
        columns={columns}
        onRowClick={handleViewRecord}
        onSearch={handleSearch}
        loading={loading}
        pagination={{
          ...pagination,
          onPageChange: handlePageChange,
        }}
        searchPlaceholder="Pesquisar por produto, location origem, location destino..."
        emptyMessage="Nenhuma transferência registrada."
        gridId="transferencias"
        showActions={false}
        getRowClassName={(record) => {
          const isCancelada = record.status === 'CANCELADA';
          const isConfirmada = record.status === 'CONFIRMADA';
          if (isCancelada) return 'bg-red-50 hover:bg-red-100';
          if (isConfirmada) return 'bg-green-50 hover:bg-green-100';
          return '';
        }}
      />

      <AdicionarTransferenciaModal
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        onSuccess={() => {
          loadData(pagination.page, '');
        }}
      />
    </div>
  );
}

export default Transferencias;
