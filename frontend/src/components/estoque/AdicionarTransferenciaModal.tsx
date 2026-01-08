import { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Select from '../common/Select';
import Input from '../common/Input';
import ErrorMessage from '../common/ErrorMessage';
import { locationsService, type Location } from '../../services/estoque/locations';
import { produtosService, type Produto } from '../../services/cadastros/produtos';
import { estoqueService, type Estoque } from '../../services/estoque/estoque';

interface AdicionarTransferenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Modal para adicionar transferência de estoque
 */
export default function AdicionarTransferenciaModal({
  isOpen,
  onClose,
  onSuccess,
}: AdicionarTransferenciaModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  
  // Dados do formulário
  const [produtoSKU, setProdutoSKU] = useState('');
  const [locationOrigem, setLocationOrigem] = useState('');
  const [locationDestino, setLocationDestino] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [observacao, setObservacao] = useState('');
  
  // Dados carregados
  const [locations, setLocations] = useState<Location[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [estoqueOrigem, setEstoqueOrigem] = useState<Estoque | null>(null);
  const [validandoSKU, setValidandoSKU] = useState(false);

  // Carregar locations ao abrir
  useEffect(() => {
    if (!isOpen) return;
    
    const carregarDados = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const response = await locationsService.list({ page_size: 1000 });
        const locationsList = Array.isArray(response)
          ? response
          : response.results || [];
        setLocations(locationsList.filter((loc: any) => 
          (loc.is_active !== false || loc.ativo !== false)
        ));
      } catch (err) {
        setError('Erro ao carregar locations. Tente novamente.');
        console.error('Erro ao carregar locations:', err);
      } finally {
        setLoadingData(false);
      }
    };

    carregarDados();
  }, [isOpen]);

  // Carregar estoque quando produto e location origem forem selecionados
  useEffect(() => {
    if (produtoSKU && locationOrigem && produtoSelecionado) {
      loadEstoqueOrigem();
    } else {
      setEstoqueOrigem(null);
    }
  }, [produtoSKU, locationOrigem, produtoSelecionado]);

  const validarSKU = async (sku: string) => {
    if (!sku || sku.trim() === '') {
      setProdutoSelecionado(null);
      setEstoqueOrigem(null);
      return;
    }

    try {
      setValidandoSKU(true);
      setError(null);
      const produto = await produtosService.get(parseInt(sku));
      setProdutoSelecionado(produto);
    } catch (err: any) {
      console.error('Erro ao buscar produto:', err);
      setProdutoSelecionado(null);
      setEstoqueOrigem(null);
      if (err.response?.status === 404) {
        setError('Produto não encontrado. Verifique o SKU.');
      } else {
        setError('Erro ao buscar produto. Verifique o SKU.');
      }
    } finally {
      setValidandoSKU(false);
    }
  };

  const loadEstoqueOrigem = async () => {
    if (!produtoSKU || !locationOrigem || !produtoSelecionado) {
      return;
    }

    try {
      const estoques = await estoqueService.list({
        page_size: 1000,
        produto: produtoSelecionado.codigo_produto,
        location: parseInt(locationOrigem),
      });
      
      const estoquesList = 'results' in estoques ? estoques.results : estoques;
      const estoquesArray = Array.isArray(estoquesList) ? estoquesList : [];
      
      const estoque = estoquesArray.find((e: Estoque) => {
        const produtoMatch = Number(e.produto) === Number(produtoSelecionado.codigo_produto);
        const locationMatch = Number(e.location) === Number(locationOrigem);
        return produtoMatch && locationMatch;
      });
      
      setEstoqueOrigem(estoque || null);
      
      if (!estoque || parseFloat(estoque.quantidade_disponivel || '0') <= 0) {
        if (!estoque) {
          setError('Não há estoque cadastrado para este produto na location de origem.');
        } else {
          setError('Não há estoque disponível na location de origem para este produto.');
        }
      } else {
        setError(null);
      }
    } catch (err: any) {
      console.error('Erro ao carregar estoque:', err);
      setEstoqueOrigem(null);
      setError('Erro ao carregar informações de estoque.');
    }
  };

  const handleSKUChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sku = e.target.value;
    setProdutoSKU(sku);
    
    if (sku.trim()) {
      const timeoutId = setTimeout(() => {
        validarSKU(sku);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setProdutoSelecionado(null);
      setEstoqueOrigem(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validações
    if (!produtoSelecionado) {
      setError('Por favor, informe um SKU válido.');
      setLoading(false);
      return;
    }

    if (!estoqueOrigem) {
      setError('Não há estoque disponível na location de origem.');
      setLoading(false);
      return;
    }

    const qtd = parseFloat(quantidade);
    const disponivel = parseFloat(estoqueOrigem.quantidade_disponivel);

    if (qtd <= 0) {
      setError('Quantidade deve ser maior que zero.');
      setLoading(false);
      return;
    }

    if (qtd > disponivel) {
      setError(`Quantidade solicitada (${qtd}) excede o estoque disponível (${disponivel}).`);
      setLoading(false);
      return;
    }

    if (locationOrigem === locationDestino) {
      setError('Location de origem e destino não podem ser a mesma.');
      setLoading(false);
      return;
    }

    try {
      await estoqueService.processarTransferencia({
        produto_id: produtoSelecionado.codigo_produto,
        location_origem_id: Number(locationOrigem),
        location_destino_id: Number(locationDestino),
        quantidade: quantidade,
        observacoes: observacao || undefined,
      });

      // Limpar formulário
      setProdutoSKU('');
      setLocationOrigem('');
      setLocationDestino('');
      setQuantidade('');
      setObservacao('');
      setProdutoSelecionado(null);
      setEstoqueOrigem(null);
      
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('Erro ao processar transferência:', err);
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          err.response?.data?.message || 
                          'Erro ao processar transferência';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setProdutoSKU('');
    setLocationOrigem('');
    setLocationDestino('');
    setQuantidade('');
    setObservacao('');
    setProdutoSelecionado(null);
    setEstoqueOrigem(null);
    setError(null);
    onClose();
  };

  const locationsOrigem = locations.filter(loc => loc.permite_saida && (loc.is_active !== false || loc.ativo !== false));
  const locationsDestino = locations.filter(loc => 
    loc.permite_entrada && 
    (loc.is_active !== false || loc.ativo !== false) &&
    loc.id.toString() !== locationOrigem
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Adicionar Transferência"
      size="lg"
    >
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
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SKU do Produto */}
            <div>
              <Input
                label="SKU do Produto *"
                name="produto_sku"
                type="number"
                value={produtoSKU}
                onChange={handleSKUChange}
                required
                placeholder="Digite o SKU do produto"
                disabled={validandoSKU}
              />
              {validandoSKU && (
                <p className="mt-1 text-sm text-gray-500">Validando SKU...</p>
              )}
              {produtoSelecionado && (
                <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
                  <p className="text-sm font-semibold text-blue-900">{produtoSelecionado.nome}</p>
                  <p className="text-xs text-blue-700">Código: {produtoSelecionado.codigo_produto}</p>
                </div>
              )}
            </div>

            {/* Location de Origem */}
            <div>
              <Select
                label="Location de Origem *"
                name="location_origem"
                value={locationOrigem}
                onChange={(e) => setLocationOrigem(e.target.value)}
                required
                options={[
                  { value: '', label: 'Selecione...' },
                  ...locationsOrigem.map(loc => ({
                    value: loc.id.toString(),
                    label: `${loc.nome} (${loc.codigo})`,
                  })),
                ]}
                disabled={!produtoSelecionado}
              />
              {estoqueOrigem && (
                <div className="mt-2 p-3 bg-green-50 rounded border border-green-200">
                  <p className="text-sm font-semibold text-green-900">Estoque Disponível</p>
                  <p className="text-xs text-green-700">
                    Qtd. Disponível: {parseFloat(estoqueOrigem.quantidade_disponivel).toLocaleString('pt-BR', { 
                      minimumFractionDigits: 3, 
                      maximumFractionDigits: 3 
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* Location de Destino */}
            <div>
              <Select
                label="Location de Destino *"
                name="location_destino"
                value={locationDestino}
                onChange={(e) => setLocationDestino(e.target.value)}
                required
                options={[
                  { value: '', label: 'Selecione...' },
                  ...locationsDestino.map(loc => ({
                    value: loc.id.toString(),
                    label: `${loc.nome} (${loc.codigo})`,
                  })),
                ]}
                disabled={!locationOrigem}
              />
            </div>

            {/* Quantidade */}
            <div>
              <Input
                label="Quantidade *"
                name="quantidade"
                type="number"
                step="0.001"
                min="0.001"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
                placeholder="0.000"
                disabled={!estoqueOrigem}
              />
              {estoqueOrigem && quantidade && (
                <p className="mt-1 text-xs text-gray-500">
                  Disponível: {parseFloat(estoqueOrigem.quantidade_disponivel).toLocaleString('pt-BR', { 
                    minimumFractionDigits: 3, 
                    maximumFractionDigits: 3 
                  })}
                </p>
              )}
            </div>

            {/* Observação */}
            <div className="md:col-span-2">
              <Input
                label="Observação"
                name="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Observações sobre a transferência"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={loading || !estoqueOrigem || !produtoSelecionado}
            >
              {loading ? 'Processando...' : 'Processar Transferência'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

