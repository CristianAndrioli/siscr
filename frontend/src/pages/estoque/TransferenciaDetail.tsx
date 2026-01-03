import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DetailView from '../../components/common/DetailView';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Textarea from '../../components/common/Textarea';
import ErrorMessage from '../../components/common/ErrorMessage';
import { transferenciasService, type Transferencia } from '../../services/estoque/transferencias';
import { movimentacoesService } from '../../services/estoque/movimentacoes';
import api from '../../services/api';

/**
 * Página de detalhamento de Transferência
 */
export function TransferenciaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transferencia, setTransferencia] = useState<Transferencia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [cancelError, setCancelError] = useState('');

  useEffect(() => {
    if (id) {
      loadTransferencia();
    }
  }, [id]);

  const loadTransferencia = async () => {
    try {
      setLoading(true);
      setError('');
      // Buscar transferência pelo ID da movimentação de saída
      const data = await transferenciasService.get(parseInt(id!));
      setTransferencia(data);
    } catch (err: any) {
      console.error('Erro ao carregar transferência:', err);
      setError(err.response?.data?.message || 'Erro ao carregar transferência');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelar = async () => {
    if (!transferencia || !motivoCancelamento.trim()) {
      setCancelError('Por favor, informe o motivo do cancelamento.');
      return;
    }

    try {
      setCancelando(true);
      setCancelError('');
      
      // Chamar endpoint de cancelamento
      const response = await api.post(
        `/estoque/movimentacoes/${transferencia.movimentacao_saida_id}/cancelar-transferencia/`,
        { motivo: motivoCancelamento }
      );
      
      // Recarregar transferência para atualizar status
      await loadTransferencia();
      
      // Fechar modal
      setShowCancelModal(false);
      setMotivoCancelamento('');
    } catch (err: any) {
      console.error('Erro ao cancelar transferência:', err);
      setCancelError(
        err.response?.data?.error || 
        err.response?.data?.message || 
        'Erro ao cancelar transferência'
      );
    } finally {
      setCancelando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando transferência...</p>
        </div>
      </div>
    );
  }

  if (error || !transferencia) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error || 'Transferência não encontrada'}
        </div>
        <Button onClick={() => navigate('/estoque/transferencias')}>
          Voltar para Transferências
        </Button>
      </div>
    );
  }

  const isCancelada = transferencia.status === 'CANCELADA';
  const isConfirmada = transferencia.status === 'CONFIRMADA';

  const fields = [
    {
      key: 'produto_nome',
      label: 'Produto',
      render: () => `${transferencia.produto_nome} (${transferencia.produto_codigo})`,
    },
    {
      key: 'location_origem_nome',
      label: 'Location de Origem',
      render: () => `${transferencia.location_origem_nome} (${transferencia.location_origem_codigo})`,
    },
    {
      key: 'location_destino_nome',
      label: 'Location de Destino',
      render: () => `${transferencia.location_destino_nome} (${transferencia.location_destino_codigo})`,
    },
    {
      key: 'quantidade',
      label: 'Quantidade',
      render: () => Number(transferencia.quantidade).toLocaleString('pt-BR', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      }),
    },
    {
      key: 'valor_unitario',
      label: 'Valor Unitário',
      render: () => new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(transferencia.valor_unitario)),
    },
    {
      key: 'valor_total',
      label: 'Valor Total',
      render: () => new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(Number(transferencia.valor_total)),
    },
    {
      key: 'status',
      label: 'Status',
      render: () => (
        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
          isCancelada 
            ? 'bg-red-100 text-red-800' 
            : isConfirmada 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }`}>
          {isCancelada ? 'Cancelada' : isConfirmada ? 'Confirmada' : transferencia.status}
        </span>
      ),
    },
    {
      key: 'data_movimentacao',
      label: 'Data da Movimentação',
      render: () => transferencia.data_movimentacao 
        ? new Date(transferencia.data_movimentacao).toLocaleString('pt-BR')
        : '-',
    },
    {
      key: 'created_at',
      label: 'Criado em',
      render: () => transferencia.created_at 
        ? new Date(transferencia.created_at).toLocaleString('pt-BR')
        : '-',
    },
    {
      key: 'documento_referencia',
      label: 'Documento de Referência',
      render: () => transferencia.documento_referencia || '-',
    },
    {
      key: 'observacoes',
      label: 'Observações',
      render: () => transferencia.observacoes || '-',
    },
  ];

  // Adicionar campo de motivo de cancelamento se estiver cancelada
  if (isCancelada && transferencia.motivo_cancelamento) {
    fields.push({
      key: 'motivo_cancelamento',
      label: 'Motivo do Cancelamento',
      render: () => (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          <p className="text-sm text-red-800">{transferencia.motivo_cancelamento}</p>
        </div>
      ),
    });
  }

  return (
    <>
      <DetailView
        title={`Transferência #${transferencia.id}`}
        subtitle={`${transferencia.produto_nome} - ${transferencia.location_origem_nome} → ${transferencia.location_destino_nome}`}
        fields={fields}
        data={transferencia as any}
        onBack={() => navigate('/estoque/transferencias')}
        showActions={true}
        error={error}
      >
        {!isCancelada && (
          <Button
            variant="danger"
            onClick={() => setShowCancelModal(true)}
            className="ml-2"
          >
            Cancelar Transferência
          </Button>
        )}
      </DetailView>

      {/* Modal de Cancelamento */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => {
          setShowCancelModal(false);
          setMotivoCancelamento('');
          setCancelError('');
        }}
        title="Cancelar Transferência"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
            <p className="text-sm text-yellow-800">
              <strong>Atenção:</strong> Ao cancelar esta transferência, as movimentações de estoque serão revertidas:
            </p>
            <ul className="mt-2 text-sm text-yellow-700 list-disc list-inside">
              <li>A quantidade será devolvida à location de origem</li>
              <li>A quantidade será removida da location de destino</li>
              <li>A transferência será marcada como cancelada (não será excluída)</li>
            </ul>
          </div>

          {cancelError && (
            <ErrorMessage
              message={cancelError}
              onClose={() => setCancelError('')}
            />
          )}

          <Textarea
            label="Motivo do Cancelamento *"
            name="motivo"
            value={motivoCancelamento}
            onChange={(e) => setMotivoCancelamento(e.target.value)}
            placeholder="Informe o motivo do cancelamento"
            required
            rows={4}
          />

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => {
                setShowCancelModal(false);
                setMotivoCancelamento('');
                setCancelError('');
              }}
              disabled={cancelando}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelar}
              disabled={cancelando || !motivoCancelamento.trim()}
            >
              {cancelando ? 'Cancelando...' : 'Confirmar Cancelamento'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default TransferenciaDetail;

