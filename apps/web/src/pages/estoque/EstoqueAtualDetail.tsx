import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView } from '../../components/common';
import { estoqueService, type Estoque } from '../../services/estoque';

/**
 * Página de detalhamento de Estoque Atual
 * Somente leitura (ReadOnlyModelViewSet)
 */
export function EstoqueAtualDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const {
    currentRecord,
    loading,
    error,
    loadRecord,
  } = useCrud<Estoque>({
    service: estoqueService,
    basePath: '/estoque/estoque-atual',
    getRecordId: (record) => record.id,
  });

  useEffect(() => {
    if (id) {
      loadRecord(id);
    }
  }, [id, loadRecord]);

  if (loading && !currentRecord) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const fields = [
    { key: 'id', label: 'ID' },
    { 
      key: 'produto_nome', 
      label: 'Produto' 
    },
    { 
      key: 'produto_codigo', 
      label: 'Código do Produto' 
    },
    { 
      key: 'location_nome', 
      label: 'Location' 
    },
    { 
      key: 'location_codigo', 
      label: 'Código da Location' 
    },
    { 
      key: 'empresa_nome', 
      label: 'Empresa' 
    },
    {
      key: 'quantidade_atual',
      label: 'Quantidade Atual',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '0';
        return Number(v).toLocaleString('pt-BR', { 
          minimumFractionDigits: 3, 
          maximumFractionDigits: 3 
        });
      },
    },
    {
      key: 'quantidade_disponivel',
      label: 'Quantidade Disponível',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '0';
        return Number(v).toLocaleString('pt-BR', { 
          minimumFractionDigits: 3, 
          maximumFractionDigits: 3 
        });
      },
    },
    {
      key: 'quantidade_reservada',
      label: 'Quantidade Reservada',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '0';
        return Number(v).toLocaleString('pt-BR', { 
          minimumFractionDigits: 3, 
          maximumFractionDigits: 3 
        });
      },
    },
    {
      key: 'quantidade_prevista',
      label: 'Quantidade Prevista',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '0';
        return Number(v).toLocaleString('pt-BR', { 
          minimumFractionDigits: 3, 
          maximumFractionDigits: 3 
        });
      },
    },
    {
      key: 'quantidade_disponivel_com_prevista',
      label: 'Quantidade Disponível (com Prevista)',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '0';
        return Number(v).toLocaleString('pt-BR', { 
          minimumFractionDigits: 3, 
          maximumFractionDigits: 3 
        });
      },
    },
    {
      key: 'custo_medio',
      label: 'Custo Médio',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '-';
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(Number(v));
      },
    },
    {
      key: 'valor_total',
      label: 'Valor Total',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '-';
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(Number(v));
      },
    },
    {
      key: 'estoque_minimo',
      label: 'Estoque Mínimo',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '-';
        return Number(v).toLocaleString('pt-BR', { 
          minimumFractionDigits: 3, 
          maximumFractionDigits: 3 
        });
      },
    },
    {
      key: 'estoque_maximo',
      label: 'Estoque Máximo',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '-';
        return Number(v).toLocaleString('pt-BR', { 
          minimumFractionDigits: 3, 
          maximumFractionDigits: 3 
        });
      },
    },
    {
      key: 'abaixo_estoque_minimo',
      label: 'Abaixo do Estoque Mínimo',
      render: (v: unknown) => {
        return v ? (
          <span className="text-red-600 font-semibold">Sim</span>
        ) : (
          <span className="text-gray-600">Não</span>
        );
      },
    },
    {
      key: 'created_at',
      label: 'Data de Criação',
      render: (v: unknown) => {
        if (!v) return '-';
        return new Date(String(v)).toLocaleString('pt-BR');
      },
    },
    {
      key: 'updated_at',
      label: 'Última Atualização',
      render: (v: unknown) => {
        if (!v) return '-';
        return new Date(String(v)).toLocaleString('pt-BR');
      },
    },
  ];

  return (
    <DetailView
      title={`Estoque #${currentRecord?.id || id}`}
      subtitle={
        currentRecord?.produto_nome 
          ? `${currentRecord.produto_nome} - ${currentRecord.location_nome}`
          : `ID: ${id}`
      }
      fields={fields}
      data={currentRecord as Record<string, unknown>}
      onBack={() => navigate('/estoque/estoque-atual')}
      loading={loading}
      error={error}
    />
  );
}

export default EstoqueAtualDetail;

