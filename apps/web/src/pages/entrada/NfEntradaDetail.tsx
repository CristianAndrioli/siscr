import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import * as entradaService from '../../services/entradaService';
import { comprasService, type ItemPedidoCompraRow, type PedidoCompraListItem } from '../../services/compras';
import { produtosService, type Produto } from '../../services/cadastros/produtos';
import { PessoaBusca } from '../../components/PessoaBusca';
import { fmtBRL, fmtDate } from '../../utils/format';
import { formatApiError } from '../../utils/helpers';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

interface EmpresaRow { id: string; razao_social: string }
interface FilialRow { id: string; nome: string; empresa_id: string }
interface ContaPagarRef {
  id: string;
  codigo?: number;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
}

type ItemForm = {
  produtoId: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  desconto: number;
  unidade: string;
  itemPedidoId: string;
};

type DupForm = { vencimento: string; valor: number };

const emptyItem = (): ItemForm => ({
  produtoId: '',
  descricao: '',
  quantidade: 1,
  valorUnitario: 0,
  desconto: 0,
  unidade: 'UN',
  itemPedidoId: '',
});

export default function NfEntradaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Rota dedicada `/entrada/notas/novo` não tem `:id` — sem isso o form
  // nunca monta e a tela fica em "Carregando…".
  const isNew = !id || id === 'novo';
  const { reportError } = useErrorNotification();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ─── leitura (registro existente) ───────────────────────────────────────────
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [gerando, setGerando] = useState(false);
  const [vincBusy, setVincBusy] = useState(false);
  const [fornecedorIdRead, setFornecedorIdRead] = useState('');
  const [fornecedorNomeRead, setFornecedorNomeRead] = useState('');

  // ─── formulário (lançamento manual) ─────────────────────────────────────────
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [filiais, setFiliais] = useState<FilialRow[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [filialId, setFilialId] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [numero, setNumero] = useState('');
  const [serie, setSerie] = useState('1');
  const [dataEmissao, setDataEmissao] = useState(() => new Date().toISOString().slice(0, 10));
  const [naturezaOperacao, setNaturezaOperacao] = useState('Compra de mercadorias');
  const [descontoNota, setDescontoNota] = useState(0);
  const [itens, setItens] = useState<ItemForm[]>([emptyItem()]);
  const [duplicatas, setDuplicatas] = useState<DupForm[]>([]);
  const [pedidoCompraId, setPedidoCompraId] = useState('');
  const [pedidosAbertos, setPedidosAbertos] = useState<PedidoCompraListItem[]>([]);
  const [itensPedido, setItensPedido] = useState<ItemPedidoCompraRow[]>([]);
  const [gerarEstoque, setGerarEstoque] = useState(true);
  const [gerarContasPagar, setGerarContasPagar] = useState(true);

  useEffect(() => {
    if (!isNew) return;
    api.get('/tenant/info/empresas').then((r) => {
      const list = (r.data?.empresas ?? []) as EmpresaRow[];
      setEmpresas(list);
      setEmpresaId((prev) => prev || list[0]?.id || '');
    }).catch(() => {});
    api.get('/tenant/info/filiais').then((r) => setFiliais(r.data?.filiais ?? [])).catch(() => {});
    produtosService.list({ limit: 300 }).then((r) => setProdutos(r.produtos)).catch(() => {});
  }, [isNew]);

  const load = useCallback(async () => {
    if (isNew || !id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await entradaService.getNfEntrada(id);
      setData(d);
      if (d.fornecedor_id) {
        setFornecedorIdRead(d.fornecedor_id as string);
        setFornecedorNomeRead((d.fornecedor_nome as string) || '');
      }
    } catch {
      reportError('Nota não encontrada.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, isNew, reportError]);

  useEffect(() => {
    load();
  }, [load]);

  // Pedidos abertos do fornecedor (para vínculo).
  useEffect(() => {
    if (!isNew || !fornecedorId || !empresaId) {
      setPedidosAbertos([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [a, b] = await Promise.all([
          comprasService.list({ status: 'confirmado', empresaId, fornecedorId }),
          comprasService.list({ status: 'recebido_parcial', empresaId, fornecedorId }),
        ]);
        if (!cancelled) setPedidosAbertos([...a, ...b].sort((x, y) => y.numero - x.numero));
      } catch {
        if (!cancelled) setPedidosAbertos([]);
      }
    })();
    return () => { cancelled = true; };
  }, [isNew, fornecedorId, empresaId]);

  useEffect(() => {
    if (!pedidoCompraId) {
      setItensPedido([]);
      return;
    }
    comprasService.get(pedidoCompraId).then((r) => setItensPedido(r.itens)).catch(() => setItensPedido([]));
  }, [pedidoCompraId]);

  const filiaisDaEmpresa = filiais.filter((f) => f.empresa_id === empresaId);

  const setItemField = (idx: number, field: keyof ItemForm, value: string | number) => {
    setItens((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, [field]: value };
        if (field === 'produtoId') {
          const prod = produtos.find((p) => p.id === value);
          if (prod) {
            next.descricao = prod.descricao;
            next.valorUnitario = prod.preco_custo || prod.preco_venda || 0;
            next.unidade = prod.unidade || 'UN';
          }
        }
        if (field === 'itemPedidoId' && typeof value === 'string' && value) {
          const ip = itensPedido.find((p) => p.id === value);
          if (ip) {
            next.produtoId = ip.produto_id;
            next.descricao = ip.produto_descricao;
            next.valorUnitario = ip.preco_unitario;
            const saldo = Math.max(ip.quantidade - ip.quantidade_recebida, 0);
            if (!next.quantidade || next.quantidade > saldo) next.quantidade = saldo || 1;
          }
        }
        return next;
      }),
    );
  };

  const addItem = () => setItens((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) =>
    setItens((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev));

  const totalItens = itens.reduce(
    (s, it) => s + Math.max(it.quantidade * it.valorUnitario - (it.desconto || 0), 0),
    0,
  );
  const totalNota = Math.max(totalItens - (descontoNota || 0), 0);

  const handleSalvar = async () => {
    setError('');
    if (!empresaId) { setError('Selecione a empresa.'); return; }
    if (!fornecedorId) { setError('Selecione o fornecedor.'); return; }
    const num = Number(numero);
    if (!Number.isInteger(num) || num <= 0) { setError('Informe o número da nota (inteiro positivo).'); return; }
    if (!serie.trim()) { setError('Informe a série.'); return; }
    if (!dataEmissao) { setError('Informe a data de emissão.'); return; }
    const itensValidos = itens.filter((it) => it.produtoId && it.quantidade > 0);
    if (itensValidos.length === 0) { setError('Adicione ao menos um item com produto e quantidade.'); return; }
    for (const it of itensValidos) {
      if (!it.descricao.trim()) { setError('Todo item precisa de descrição.'); return; }
      if (it.valorUnitario < 0) { setError('Valor unitário não pode ser negativo.'); return; }
      if ((it.desconto || 0) > it.quantidade * it.valorUnitario) {
        setError(`Desconto do item “${it.descricao}” é maior que o total da linha.`);
        return;
      }
    }
    if (duplicatas.length > 0) {
      for (const d of duplicatas) {
        if (!d.vencimento || !(d.valor > 0)) {
          setError('Preencha vencimento e valor de todas as duplicatas, ou remova-as.');
          return;
        }
      }
    }

    setSaving(true);
    try {
      const res = await entradaService.criarNfEntradaManual({
        empresaId,
        filialId: filialId || null,
        fornecedorId,
        numero: num,
        serie: serie.trim(),
        dataEmissao,
        naturezaOperacao: naturezaOperacao || undefined,
        desconto: descontoNota || 0,
        itens: itensValidos.map((it) => ({
          produtoId: it.produtoId,
          descricao: it.descricao.trim(),
          quantidade: it.quantidade,
          valorUnitario: it.valorUnitario,
          desconto: it.desconto || 0,
          unidade: it.unidade || 'UN',
          itemPedidoId: it.itemPedidoId || null,
        })),
        cobranca: duplicatas.length > 0 ? duplicatas : undefined,
        pedidoCompraId: pedidoCompraId || undefined,
        gerarEstoque,
        gerarContasPagar,
      });
      navigate(`/entrada/notas/${res.id}`);
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao lançar nota de entrada.');
      reportError(msg, err, 'Nota de Entrada');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const vincularFornecedor = async () => {
    if (!id || !fornecedorIdRead) {
      reportError('Busque e selecione um fornecedor.');
      return;
    }
    setVincBusy(true);
    try {
      await entradaService.vincularFornecedor(id, fornecedorIdRead);
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      reportError(ax.response?.data?.error || 'Erro ao vincular.');
    } finally {
      setVincBusy(false);
    }
  };

  const gerarCp = async () => {
    if (!id) return;
    setGerando(true);
    try {
      const r = await entradaService.gerarContasPagar(id, 'Fornecedores');
      window.alert(r.message);
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      reportError(ax.response?.data?.error || 'Erro ao gerar títulos.');
    } finally {
      setGerando(false);
    }
  };

  // ─── formulário novo ────────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <button
            type="button"
            onClick={() => navigate('/entrada/notas')}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Notas de entrada
          </button>
          <h1 className="text-2xl font-bold font-display text-slate-800 dark:text-slate-100">
            Lançamento manual
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Use quando a nota não vier por XML. Relaciona fornecedor, produtos, estoque e contas a pagar.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="card p-5 space-y-5">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Cabeçalho
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Empresa *</label>
              <select
                className="input"
                value={empresaId}
                onChange={(e) => { setEmpresaId(e.target.value); setFilialId(''); setPedidoCompraId(''); }}
              >
                <option value="">Selecione…</option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>{e.razao_social}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="input-label">
                Filial <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <select
                className="input"
                value={filialId}
                disabled={!empresaId}
                onChange={(e) => setFilialId(e.target.value)}
              >
                <option value="">Matriz</option>
                {filiaisDaEmpresa.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">Fornecedor *</label>
              <PessoaBusca
                tipoCadastro="fornecedor"
                value={fornecedorId}
                displayValue={fornecedorNome}
                onChange={(fid, nome) => {
                  setFornecedorId(fid);
                  setFornecedorNome(nome);
                  setPedidoCompraId('');
                }}
              />
            </div>
            <div>
              <label className="input-label">Número *</label>
              <input
                className="input"
                type="number"
                min={1}
                step={1}
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Série *</label>
              <input className="input" value={serie} onChange={(e) => setSerie(e.target.value)} maxLength={10} />
            </div>
            <div>
              <label className="input-label">Data de emissão *</label>
              <input
                className="input"
                type="date"
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Natureza da operação</label>
              <input
                className="input"
                value={naturezaOperacao}
                onChange={(e) => setNaturezaOperacao(e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="input-label">
                Pedido de compra <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <select
                className="input"
                value={pedidoCompraId}
                disabled={!fornecedorId}
                onChange={(e) => {
                  setPedidoCompraId(e.target.value);
                  setItens((prev) => prev.map((it) => ({ ...it, itemPedidoId: '' })));
                }}
              >
                <option value="">Sem vínculo</option>
                {pedidosAbertos.map((p) => (
                  <option key={p.id} value={p.id}>
                    Pedido #{p.numero} · {p.status} · {fmtBRL(p.total)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-1">
                Se vinculado, o recebimento baixa o saldo do pedido (sem duplicar estoque nos itens casados).
              </p>
            </div>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Itens
            </p>
            <button type="button" onClick={addItem} className="btn-ghost text-xs">
              + Adicionar item
            </button>
          </div>
          <div className="space-y-3">
            {itens.map((it, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 gap-2 items-start border-b border-slate-100 dark:border-slate-800 pb-3"
              >
                {pedidoCompraId ? (
                  <div className="col-span-12 sm:col-span-4">
                    <label className="input-label">Item do pedido</label>
                    <select
                      className="input"
                      value={it.itemPedidoId}
                      onChange={(e) => setItemField(idx, 'itemPedidoId', e.target.value)}
                    >
                      <option value="">Sem vínculo de linha</option>
                      {itensPedido.map((ip) => (
                        <option key={ip.id} value={ip.id}>
                          {ip.produto_codigo} — saldo {Math.max(ip.quantidade - ip.quantidade_recebida, 0)}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className={pedidoCompraId ? 'col-span-12 sm:col-span-5' : 'col-span-12 sm:col-span-6'}>
                  <label className="input-label">Produto *</label>
                  <select
                    className="input"
                    value={it.produtoId}
                    onChange={(e) => setItemField(idx, 'produtoId', e.target.value)}
                  >
                    <option value="">Selecione…</option>
                    {produtos.map((p) => (
                      <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="input-label">Qtd *</label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    className="input"
                    value={it.quantidade || ''}
                    onChange={(e) => setItemField(idx, 'quantidade', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <label className="input-label">Vl. unit. *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input"
                    value={it.valorUnitario || ''}
                    onChange={(e) => setItemField(idx, 'valorUnitario', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-3 sm:col-span-1 flex items-end pb-1">
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="text-slate-400 hover:text-red-500 p-2"
                    aria-label="Remover item"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="col-span-12 sm:col-span-8">
                  <label className="input-label">Descrição *</label>
                  <input
                    className="input"
                    value={it.descricao}
                    onChange={(e) => setItemField(idx, 'descricao', e.target.value)}
                    maxLength={500}
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="input-label">Desconto</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="input"
                    value={it.desconto || ''}
                    onChange={(e) => setItemField(idx, 'desconto', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="input-label">Unidade</label>
                  <input
                    className="input"
                    value={it.unidade}
                    onChange={(e) => setItemField(idx, 'unidade', e.target.value)}
                    maxLength={6}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="w-40">
              <label className="input-label">Desconto da nota</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="input"
                value={descontoNota || ''}
                onChange={(e) => setDescontoNota(Number(e.target.value) || 0)}
              />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Total: <span className="font-mono text-brand-600 dark:text-brand-400">{fmtBRL(totalNota)}</span>
            </p>
          </div>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Duplicatas
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Opcional. Sem duplicatas, gera um título com o total na data de emissão.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={() =>
                setDuplicatas((prev) => [...prev, { vencimento: dataEmissao, valor: totalNota || 0 }])
              }
            >
              + Duplicata
            </button>
          </div>
          {duplicatas.map((d, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-5">
                <label className="input-label">Vencimento</label>
                <input
                  type="date"
                  className="input"
                  value={d.vencimento}
                  onChange={(e) =>
                    setDuplicatas((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, vencimento: e.target.value } : x)),
                    )
                  }
                />
              </div>
              <div className="col-span-5">
                <label className="input-label">Valor</label>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  className="input"
                  value={d.valor || ''}
                  onChange={(e) =>
                    setDuplicatas((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, valor: Number(e.target.value) } : x)),
                    )
                  }
                />
              </div>
              <div className="col-span-2">
                <button
                  type="button"
                  className="btn-ghost text-xs w-full"
                  onClick={() => setDuplicatas((prev) => prev.filter((_, i) => i !== idx))}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Integrações
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input type="checkbox" checked={gerarEstoque} onChange={(e) => setGerarEstoque(e.target.checked)} />
            Gerar movimentação de estoque
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={gerarContasPagar}
              onChange={(e) => setGerarContasPagar(e.target.checked)}
            />
            Gerar contas a pagar
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={handleSalvar} disabled={saving} className="btn-primary">
            {saving ? 'Salvando…' : 'Lançar nota'}
          </button>
          <button type="button" onClick={() => navigate('/entrada/notas')} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => navigate('/entrada/nf-e/nova')}
            className="btn-ghost text-sm"
          >
            Prefiro importar XML
          </button>
        </div>
      </div>
    );
  }

  // ─── detalhe leitura ────────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-slate-500">{loading ? 'Carregando…' : 'Registro não encontrado.'}</p>
        <Link to="/entrada/notas" className="text-brand-600 text-sm mt-4 inline-block">
          ← Voltar
        </Link>
      </div>
    );
  }

  const itensRead = (data.itens as entradaService.NfEntradaItem[]) || [];
  const contas = (data.contas_pagar as ContaPagarRef[]) || [];
  const temFornecedor = !!data.fornecedor_id;
  const chave = String(data.chave_acesso || '');
  const origem = String(data.origem || (chave.startsWith('MANUAL-') ? 'manual' : 'xml'));
  const podeGerarCp = temFornecedor && contas.length === 0;
  const isManual = origem === 'manual';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/entrada/notas" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            ← Notas de entrada
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {String(data.emitente_nome || 'Fornecedor')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            NF {String(data.numero ?? '—')}/{String(data.serie ?? '—')} · Emissão{' '}
            {data.data_emissao ? fmtDate(String(data.data_emissao)) : '—'}
            {' · '}
            <span className="font-medium">{isManual ? 'Lançamento manual' : 'Importada via XML'}</span>
          </p>
          {!isManual && (
            <p className="text-xs text-slate-400 font-mono mt-1 break-all">Chave {chave}</p>
          )}
          {data.pedido_compra_id ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Pedido de compra{' '}
              <Link
                to={`/compras/pedidos/${String(data.pedido_compra_id)}`}
                className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
              >
                nº {String(data.pedido_compra_numero ?? '—')}
              </Link>
              {data.pedido_compra_status
                ? ` · ${String(data.pedido_compra_status).replace('_', ' ')}`
                : ''}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {fmtBRL(Number(data.valor_total))}
          </div>
          <div className="text-xs text-slate-500">Total</div>
        </div>
      </div>

      {!isManual && data.assinatura_valida === 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Assinatura digital não validada ou ausente no arquivo — confira o XML antes de usar em produção.
        </div>
      )}

      {!temFornecedor && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Vincular fornecedor</h2>
          <p className="text-sm text-slate-500">
            Não encontramos cadastro de fornecedor com o CNPJ{' '}
            <strong>{String(data.emitente_cnpj)}</strong>. Busque abaixo ou cadastre em Pessoas.
          </p>
          <PessoaBusca
            tipoCadastro="fornecedor"
            value={fornecedorIdRead}
            displayValue={fornecedorNomeRead}
            onChange={(fid, nome) => {
              setFornecedorIdRead(fid);
              setFornecedorNomeRead(nome);
            }}
          />
          <button
            type="button"
            disabled={vincBusy || !fornecedorIdRead}
            onClick={vincularFornecedor}
            className="px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium disabled:opacity-50"
          >
            {vincBusy ? 'Salvando…' : 'Salvar vínculo'}
          </button>
        </div>
      )}

      {podeGerarCp && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-emerald-900 dark:text-emerald-100">Contas a pagar</p>
            <p className="text-sm text-emerald-800/90 dark:text-emerald-200/90">
              Gera títulos a partir das duplicatas{isManual ? '' : ' do XML'} (ou um único título com o
              total, se não houver cobrança).
            </p>
          </div>
          <button
            type="button"
            disabled={gerando}
            onClick={gerarCp}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {gerando ? 'Gerando…' : 'Gerar contas a pagar'}
          </button>
        </div>
      )}

      {contas.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Títulos vinculados</h2>
          <ul className="space-y-2">
            {contas.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/financeiro/contas-pagar/${c.id}`}
                  className="flex justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-200">{c.descricao}</span>
                  <span className="text-sm tabular-nums">
                    {fmtBRL(c.valor)} · {fmtDate(c.vencimento)} · {c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Itens</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2">CFOP</th>
                <th className="px-3 py-2 text-right">Qtd</th>
                <th className="px-3 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {itensRead.map((it, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <div>{it.descricao}</div>
                    {it.cProd && <div className="text-xs text-slate-500">cProd: {it.cProd}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {it.produto_id ? (
                      <span>
                        <Link
                          to={`/cadastros/produtos/${it.produto_id}`}
                          className="text-brand-600 dark:text-brand-400 hover:underline font-medium"
                        >
                          Abrir cadastro
                        </Link>
                        {it.criado_no_import && (
                          <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                            (criado na importação)
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{it.cfop ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{it.quantidade}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(it.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
