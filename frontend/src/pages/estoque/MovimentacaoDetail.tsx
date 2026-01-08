import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCrud } from '../../hooks/useCrud';
import { DetailView } from '../../components/common';
import { movimentacoesService, type MovimentacaoEstoque } from '../../services/estoque';

/**
 * Página de detalhamento de Movimentação de Estoque
 * Somente leitura (ReadOnlyModelViewSet)
 */
export function MovimentacaoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const {
    currentRecord,
    loading,
    error,
    loadRecord,
  } = useCrud<MovimentacaoEstoque>({
    service: movimentacoesService,
    basePath: '/estoque/movimentacoes',
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
      key: 'location_nome', 
      label: 'Location' 
    },
    {
      key: 'location_origem_nome',
      label: 'Location Origem',
      render: (v: unknown) => v || '-',
    },
    {
      key: 'location_destino_nome',
      label: 'Location Destino',
      render: (v: unknown) => v || '-',
    },
    {
      key: 'tipo',
      label: 'Tipo',
      render: (value: string) => {
        const tipos: Record<string, string> = {
          'ENTRADA': 'Entrada',
          'SAIDA': 'Saída',
          'TRANSFERENCIA': 'Transferência',
          'TRANSFERENCIA_ORIGEM': 'Transferência (Origem)',
          'TRANSFERENCIA_DESTINO': 'Transferência (Destino)',
          'AJUSTE': 'Ajuste',
          'RESERVA': 'Reserva',
          'CANCELAMENTO_RESERVA': 'Cancelamento de Reserva',
        };
        return tipos[value] || value;
      },
    },
    { 
      key: 'origem', 
      label: 'Origem' 
    },
    { 
      key: 'status', 
      label: 'Status' 
    },
    {
      key: 'quantidade',
      label: 'Quantidade',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '0';
        return Number(v).toLocaleString('pt-BR', { 
          minimumFractionDigits: 3, 
          maximumFractionDigits: 3 
        });
      },
    },
    {
      key: 'quantidade_anterior',
      label: 'Quantidade Anterior',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '-';
        return Number(v).toLocaleString('pt-BR', { 
          minimumFractionDigits: 3, 
          maximumFractionDigits: 3 
        });
      },
    },
    {
      key: 'quantidade_posterior',
      label: 'Quantidade Posterior',
      render: (v: unknown) => {
        if (v === null || v === undefined) return '-';
        return Number(v).toLocaleString('pt-BR', { 
          minimumFractionDigits: 3, 
          maximumFractionDigits: 3 
        });
      },
    },
    {
      key: 'valor_unitario',
      label: 'Valor Unitário',
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
      key: 'data_movimentacao',
      label: 'Data da Movimentação',
      render: (v: unknown) => {
        if (!v) return '-';
        return new Date(String(v)).toLocaleString('pt-BR');
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
      key: 'documento_referencia',
      label: 'Documento de Referência',
      render: (v: unknown) => v || '-',
    },
    {
      key: 'observacoes',
      label: 'Observações',
      render: (v: unknown) => v || '-',
    },
  ];

  return (
    <DetailView
      title={`Movimentação #${currentRecord?.id || id}`}
      subtitle={currentRecord?.produto_nome ? `Produto: ${currentRecord.produto_nome}` : `ID: ${id}`}
      fields={fields}
      data={currentRecord as Record<string, unknown>}
      onBack={() => navigate('/estoque/movimentacoes')}
      loading={loading}
      error={error}
    />
  );
}

export default MovimentacaoDetail;

