import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Select from '../common/Select';
import Input from '../common/Input';
import ErrorMessage from '../common/ErrorMessage';
import { locationsService, type Location } from '../../services/estoque/locations';
import { produtosService, type Produto } from '../../services/cadastros/produtos';
import { estoqueService } from '../../services/estoque/estoque';

interface EntradaEstoque {
  id: string; // ID único para a linha
  location_id: string;
  produto_id: string;
  quantidade: string;
  valor_unitario: string;
}

interface AdicionarEstoqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal para adicionar múltiplas entradas de estoque (modo desenvolvimento)
 */
export default function AdicionarEstoqueModal({
  isOpen,
  onClose,
  onSuccess,
}: AdicionarEstoqueModalProps) {
  const [entradas, setEntradas] = useState<EntradaEstoque[]>([
    { id: '1', location_id: '', produto_id: '', quantidade: '', valor_unitario: '0.00' },
  ]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Carregar locations e produtos
  useEffect(() => {
    if (!isOpen) return;

    const carregarDados = async () => {
      setLoadingData(true);
      setError(null);
      try {
        // Carregar locations que permitem entrada
        const locationsResponse = await locationsService.list({ page_size: 1000 });
        const locationsList = Array.isArray(locationsResponse)
          ? locationsResponse
          : locationsResponse.results || [];
        
        console.log('Total de locations recebidas:', locationsList.length);
        if (locationsList.length > 0) {
          console.log('Primeira location (exemplo):', locationsList[0]);
        }
        
        // Filtrar locations que permitem entrada e estão ativas
        // O campo do modelo é 'is_active', mas pode ser retornado como 'ativo' ou 'is_active'
        const locationsComEntrada = locationsList.filter((loc: any) => {
          // Verificar se permite entrada (default é true se não especificado)
          const permiteEntrada = loc.permite_entrada !== false;
          
          // Verificar se está ativa (aceita ambos os nomes de campo)
          const estaAtiva = loc.is_active !== false || (loc.ativo !== false && loc.ativo !== undefined);
          
          const resultado = permiteEntrada && estaAtiva;
          if (!resultado) {
            console.log(`Location ${loc.nome} filtrada: permite_entrada=${permiteEntrada}, is_active=${loc.is_active}, ativo=${loc.ativo}`);
          }
          return resultado;
        });
        
        console.log('Locations filtradas (com entrada e ativas):', locationsComEntrada.length);
        if (locationsComEntrada.length > 0) {
          console.log('Locations disponíveis:', locationsComEntrada.map(l => ({ id: l.id, nome: l.nome, permite_entrada: l.permite_entrada, is_active: l.is_active })));
        }
        
        if (locationsComEntrada.length === 0 && locationsList.length > 0) {
          setError('Nenhuma location encontrada que permita entrada. Verifique se há locations cadastradas com permite_entrada=true e is_active=true.');
        } else if (locationsList.length === 0) {
          setError('Nenhuma location cadastrada. Cadastre locations primeiro.');
        }
        
        setLocations(locationsComEntrada);

        // Carregar produtos
        const produtosResponse = await produtosService.list({ page_size: 1000 });
        const produtosList = Array.isArray(produtosResponse)
          ? produtosResponse
          : produtosResponse.results || [];
        setProdutos(produtosList.filter((p: Produto) => p.ativo !== false));
      } catch (err) {
        setError('Erro ao carregar dados. Tente novamente.');
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoadingData(false);
      }
    };

    carregarDados();
  }, [isOpen]);

  const adicionarLinha = () => {
    const novoId = Date.now().toString();
    setEntradas([
      ...entradas,
      { id: novoId, location_id: '', produto_id: '', quantidade: '', valor_unitario: '0.00' },
    ]);
  };

  const removerLinha = (id: string) => {
    if (entradas.length > 1) {
      setEntradas(entradas.filter((e) => e.id !== id));
      // Remover erros da linha removida
      const novosErros = { ...errors };
      delete novosErros[`location_${id}`];
      delete novosErros[`produto_${id}`];
      delete novosErros[`quantidade_${id}`];
      setErrors(novosErros);
    }
  };

  const atualizarLinha = (id: string, campo: keyof EntradaEstoque, valor: string) => {
    setEntradas(
      entradas.map((e) => (e.id === id ? { ...e, [campo]: valor } : e))
    );
    // Limpar erro do campo ao editar
    const novoErro = { ...errors };
    delete novoErro[`${campo}_${id}`];
    setErrors(novoErro);
  };

  const validar = (): boolean => {
    const novosErros: Record<string, string> = {};
    let valido = true;

    entradas.forEach((entrada, idx) => {
      if (!entrada.location_id) {
        novosErros[`location_${entrada.id}`] = 'Location é obrigatória';
        valido = false;
      }
      if (!entrada.produto_id) {
        novosErros[`produto_${entrada.id}`] = 'SKU é obrigatório';
        valido = false;
      }
      if (!entrada.quantidade || parseFloat(entrada.quantidade) <= 0) {
        novosErros[`quantidade_${entrada.id}`] = 'Quantidade deve ser maior que zero';
        valido = false;
      }
    });

    setErrors(novosErros);
    return valido;
  };

  const handleSubmit = async () => {
    setError(null);
    setErrors({});

    if (!validar()) {
      setError('Por favor, corrija os erros antes de continuar.');
      return;
    }

    setLoading(true);

    try {
      // Preparar dados para envio
      const dados = {
        entradas: entradas.map((e) => ({
          location_id: e.location_id,
          produto_id: e.produto_id,
          quantidade: e.quantidade,
          valor_unitario: e.valor_unitario || '0.00',
          origem: 'COMPRA',
        })),
      };

      const response = await estoqueService.processarMultiplasEntradas(dados);

      if (response.success) {
        // Sucesso - fechar modal e recarregar dados
        if (onSuccess) {
          onSuccess();
        }
        handleClose();
      } else {
        setError('Erro ao processar entradas');
      }
    } catch (err: any) {
      console.error('Erro ao adicionar estoque:', err);
      // Tratar diferentes formatos de erro
      if (err.response?.data) {
        const errorData = err.response.data;
        if (errorData.erros && Array.isArray(errorData.erros)) {
          setError(errorData.erros.join('\n'));
        } else if (errorData.error) {
          setError(errorData.error);
        } else if (errorData.detail) {
          setError(errorData.detail);
        } else if (typeof errorData === 'string') {
          setError(errorData);
        } else {
          setError('Erro ao processar entradas. Verifique os dados e tente novamente.');
        }
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Erro ao processar entradas. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEntradas([{ id: '1', location_id: '', produto_id: '', quantidade: '', valor_unitario: '0.00' }]);
    setError(null);
    setErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Adicionar Estoque (Desenvolvimento)"
      size="xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <Button
            onClick={adicionarLinha}
            variant="outline"
            disabled={loading || loadingData}
          >
            + Add SKU
          </Button>
          <div className="flex gap-3">
            <Button
              onClick={handleClose}
              variant="outline"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || loadingData}
            >
              {loading ? 'Processando...' : 'Adicionar Estoque'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <ErrorMessage
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {loadingData ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-gray-600">Carregando dados...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Unitário
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {entradas.map((entrada, idx) => (
                  <tr key={entrada.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Select
                        value={entrada.location_id}
                        onChange={(e) => atualizarLinha(entrada.id, 'location_id', e.target.value)}
                        options={[
                          { value: '', label: 'Selecione...' },
                          ...locations.map((loc) => ({
                            value: loc.id.toString(),
                            label: `${loc.nome} (${loc.codigo})`,
                          })),
                        ]}
                        error={errors[`location_${entrada.id}`]}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={entrada.produto_id}
                        onChange={(e) => atualizarLinha(entrada.id, 'produto_id', e.target.value)}
                        options={[
                          { value: '', label: 'Selecione...' },
                          ...produtos.map((prod) => ({
                            value: prod.codigo_produto.toString(),
                            label: `${prod.nome} (${prod.codigo_produto})`,
                          })),
                        ]}
                        error={errors[`produto_${entrada.id}`]}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={entrada.quantidade}
                        onChange={(e) => atualizarLinha(entrada.id, 'quantidade', e.target.value)}
                        placeholder="0.000"
                        error={errors[`quantidade_${entrada.id}`]}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={entrada.valor_unitario}
                        onChange={(e) => atualizarLinha(entrada.id, 'valor_unitario', e.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {entradas.length > 1 && (
                        <button
                          onClick={() => removerLinha(entrada.id)}
                          className="text-red-600 hover:text-red-800"
                          disabled={loading}
                          title="Remover linha"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

