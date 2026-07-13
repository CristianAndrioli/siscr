import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { PessoaBusca } from '../../components/PessoaBusca';
import { produtosService, type Produto } from '../../services/cadastros/produtos';
import {
  comprasService, STATUS_LABEL, PROXIMOS_STATUS,
  type PedidoCompra, type ItemPedidoCompraRow, type ItemPedidoCompraInput, type PedidoCompraStatus,
  type Recebimento,
} from '../../services/compras';
import { fmtBRL } from '../../utils/format';
import { formatApiError } from '../../utils/helpers';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

interface EmpresaRow { id: string; razao_social: string }
interface FilialRow { id: string; nome: string; empresa_id: string }

const emptyItem = (): ItemPedidoCompraInput => ({ produtoId: '', quantidade: 1, precoUnitario: 0 });

export default function PedidoCompraDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'novo';
  const { reportError } = useErrorNotification();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [filiais, setFiliais] = useState<FilialRow[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [pedido, setPedido] = useState<PedidoCompra | null>(null);
  const [itensExistentes, setItensExistentes] = useState<ItemPedidoCompraRow[]>([]);
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);

  const [empresaId, setEmpresaId] = useState('');
  const [filialId, setFilialId] = useState('');
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemPedidoCompraInput[]>([emptyItem()]);

  const [recLocation, setRecLocation] = useState('GERAL');
  const [recObs, setRecObs] = useState('');
  const [recQtds, setRecQtds] = useState<Record<string, string>>({});
  const [recebendo, setRecebendo] = useState(false);

  const podeEditar = isNew || pedido?.status === 'rascunho';
  const podeReceber = pedido && ['confirmado', 'recebido_parcial'].includes(pedido.status);

  useEffect(() => {
    api.get('/tenant/info/empresas').then(r => setEmpresas(r.data?.empresas ?? [])).catch(() => {});
    api.get('/tenant/info/filiais').then(r => setFiliais(r.data?.filiais ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    produtosService.list({ limit: 200 }).then(r => setProdutos(r.produtos)).catch(() => {});
  }, []);

  const carregarPedido = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const { pedido: p, itens: its } = await comprasService.get(id);
      setPedido(p);
      setItensExistentes(its);
      setEmpresaId(p.empresa_id);
      setFilialId(p.filial_id);
      setFornecedorId(p.fornecedor_id);
      setObservacoes(p.observacoes ?? '');
      setItens(its.map(it => ({ produtoId: it.produto_id, quantidade: it.quantidade, precoUnitario: it.preco_unitario })));
      if (['confirmado', 'recebido_parcial', 'recebido'].includes(p.status)) {
        comprasService.listRecebimentos(id).then(setRecebimentos).catch(() => {});
      }
    } catch {
      setError('Erro ao carregar pedido de compra.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { carregarPedido(); }, [carregarPedido]);

  useEffect(() => {
    if (!fornecedorId) return;
    api.get(`/tenant/cadastros/pessoas/${fornecedorId}`).then(r => setFornecedorNome(r.data?.nome ?? '')).catch(() => {});
  }, [fornecedorId]);

  const filiaisDaEmpresa = filiais.filter(f => f.empresa_id === empresaId);

  const setItemField = (idx: number, field: keyof ItemPedidoCompraInput, value: string | number) => {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [field]: value };
      if (field === 'produtoId') {
        const prod = produtos.find(p => p.id === value);
        if (prod) next.precoUnitario = prod.preco_custo || prod.preco_venda;
      }
      return next;
    }));
  };

  const addItem = () => setItens(prev => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItens(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const total = itens.reduce((s, it) => s + it.quantidade * it.precoUnitario, 0);
  const itensValidos = itens.filter(it => it.produtoId && it.quantidade > 0);

  const handleSalvar = async () => {
    setError('');
    if (!empresaId || !filialId || !fornecedorId) { setError('Selecione empresa, filial e fornecedor.'); return; }
    if (itensValidos.length === 0) { setError('Adicione ao menos um item.'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const r = await comprasService.create({ empresaId, filialId, fornecedorId, observacoes: observacoes || undefined, itens: itensValidos });
        navigate(`/compras/pedidos/${r.id}`);
      } else if (id) {
        await comprasService.update(id, { fornecedorId, observacoes: observacoes || null as unknown as string, itens: itensValidos });
        await carregarPedido();
      }
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao salvar o pedido de compra.');
      reportError(msg, err, 'Pedido de Compra');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTransicao = async (novoStatus: PedidoCompraStatus) => {
    if (!id) return;
    if (novoStatus === 'cancelado' && !window.confirm('Cancelar este pedido de compra?')) return;
    setSaving(true);
    setError('');
    try {
      await comprasService.updateStatus(id, novoStatus);
      await carregarPedido();
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao atualizar status do pedido.');
      reportError(msg, err, 'Pedido de Compra');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleRegistrarRecebimento = async () => {
    if (!id) return;
    const linhas = Object.entries(recQtds)
      .map(([itemPedidoId, v]) => ({ itemPedidoId, quantidade: Number(v) }))
      .filter(l => l.quantidade > 0);
    if (linhas.length === 0) { setError('Informe a quantidade recebida de ao menos um item.'); return; }
    setRecebendo(true);
    setError('');
    try {
      await comprasService.registrarRecebimento(id, { location: recLocation, observacoes: recObs || undefined, itens: linhas });
      setRecQtds({});
      setRecObs('');
      await carregarPedido();
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao registrar recebimento.');
      reportError(msg, err, 'Recebimento de Compra');
      setError(msg);
    } finally {
      setRecebendo(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-64"><LoadingSpinnerInline /></div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate('/compras/pedidos')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Pedidos de Compra
          </button>
          <h1 className="text-2xl font-bold font-display text-slate-800 dark:text-slate-100">
            {isNew ? 'Novo Pedido de Compra' : `Pedido nº ${pedido?.numero}`}
          </h1>
        </div>
        {pedido && (
          <span className="badge bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 self-start">{STATUS_LABEL[pedido.status]}</span>
        )}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="card p-5 space-y-5">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Dados gerais</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="input-label">Empresa</label>
            <select className="input" value={empresaId} disabled={!podeEditar} onChange={e => { setEmpresaId(e.target.value); setFilialId(''); }}>
              <option value="">Selecione…</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.razao_social}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Filial</label>
            <select className="input" value={filialId} disabled={!podeEditar || !empresaId} onChange={e => setFilialId(e.target.value)}>
              <option value="">Selecione…</option>
              {filiaisDaEmpresa.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="input-label">Fornecedor</label>
            {podeEditar ? (
              <PessoaBusca value={fornecedorId} displayValue={fornecedorNome} tipoCadastro="fornecedor" onChange={(fid, nome) => { setFornecedorId(fid); setFornecedorNome(nome); }} />
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-200 py-2">{fornecedorNome || '—'}</p>
            )}
          </div>
        </div>
        <div>
          <label className="input-label">Observações</label>
          <textarea className="input h-auto py-2" rows={2} value={observacoes} disabled={!podeEditar} onChange={e => setObservacoes(e.target.value)} />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Itens</p>
          {podeEditar && (
            <button type="button" onClick={addItem} className="btn-ghost text-xs">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Adicionar item
            </button>
          )}
        </div>

        {podeEditar ? (
          <div className="space-y-2">
            {itens.map((it, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <select className="input col-span-6" value={it.produtoId} onChange={e => setItemField(idx, 'produtoId', e.target.value)}>
                  <option value="">Produto…</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}
                </select>
                <input type="number" min={0.01} step="0.01" className="input col-span-2" placeholder="Qtd" value={it.quantidade || ''} onChange={e => setItemField(idx, 'quantidade', Number(e.target.value))} />
                <input type="number" min={0} step="0.01" className="input col-span-3" placeholder="Custo unit." value={it.precoUnitario || ''} onChange={e => setItemField(idx, 'precoUnitario', Number(e.target.value))} />
                <button type="button" onClick={() => removeItem(idx)} className="col-span-1 text-slate-400 hover:text-red-500 flex justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[11px] uppercase text-slate-400 dark:text-slate-500">
              <th className="py-2">Produto</th><th className="py-2 text-right">Qtd</th><th className="py-2 text-right">Recebido</th><th className="py-2 text-right">Custo unit.</th><th className="py-2 text-right">Subtotal</th>
            </tr></thead>
            <tbody>
              {itensExistentes.map(it => (
                <tr key={it.id} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-2">{it.produto_codigo} — {it.produto_descricao}</td>
                  <td className="py-2 text-right font-mono">{it.quantidade}</td>
                  <td className={`py-2 text-right font-mono ${it.quantidade_recebida >= it.quantidade ? 'text-positive dark:text-positive-dark' : 'text-slate-500 dark:text-slate-400'}`}>{it.quantidade_recebida}</td>
                  <td className="py-2 text-right font-mono">{fmtBRL(it.preco_unitario)}</td>
                  <td className="py-2 text-right font-mono font-semibold">{fmtBRL(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Total: <span className="font-mono text-brand-600 dark:text-brand-400">{fmtBRL(pedido?.total ?? total)}</span></p>
        </div>
      </div>

      {podeReceber && (
        <div className="card p-5 space-y-4">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Registrar recebimento</p>
          <div className="space-y-2">
            {itensExistentes.filter(it => it.quantidade_recebida < it.quantidade).map(it => {
              const pendente = it.quantidade - it.quantidade_recebida;
              return (
                <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                  <span className="col-span-6 text-sm text-slate-700 dark:text-slate-200 truncate">{it.produto_codigo} — {it.produto_descricao}</span>
                  <span className="col-span-3 text-xs text-slate-400 dark:text-slate-500 font-mono text-right">pendente: {pendente}</span>
                  <input
                    type="number" min={0} max={pendente} step="0.01"
                    className="input col-span-3"
                    placeholder="Qtd recebida"
                    value={recQtds[it.id] ?? ''}
                    onChange={e => setRecQtds(prev => ({ ...prev, [it.id]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="input-label">Local de estoque</label>
              <input className="input" value={recLocation} onChange={e => setRecLocation(e.target.value)} placeholder="GERAL" />
            </div>
            <div>
              <label className="input-label">Observações</label>
              <input className="input" value={recObs} onChange={e => setRecObs(e.target.value)} placeholder="Nº da nota, opcional…" />
            </div>
          </div>
          <button onClick={handleRegistrarRecebimento} disabled={recebendo} className="btn-primary">
            {recebendo ? 'Registrando…' : 'Registrar recebimento'}
          </button>
        </div>
      )}

      {recebimentos.length > 0 && (
        <div className="card p-5 space-y-3">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Histórico de recebimentos</p>
          {recebimentos.map(r => (
            <div key={r.id} className="border border-slate-100 dark:border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>{new Date(r.created_at).toLocaleString('pt-BR')} · {r.location}</span>
                {r.observacoes && <span className="italic">{r.observacoes}</span>}
              </div>
              <ul className="text-sm space-y-1">
                {r.itens.map(it => (
                  <li key={it.id} className="flex justify-between text-slate-700 dark:text-slate-200">
                    <span>{it.produto_codigo} — {it.produto_descricao}</span>
                    <span className="font-mono">{it.quantidade}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {podeEditar && (
          <button onClick={handleSalvar} disabled={saving} className="btn-primary">
            {saving ? 'Salvando…' : isNew ? 'Criar pedido' : 'Salvar alterações'}
          </button>
        )}

        {pedido && PROXIMOS_STATUS[pedido.status].map(s => (
          <button key={s} onClick={() => handleTransicao(s)} disabled={saving} className={s === 'cancelado' ? 'btn-secondary text-red-600 dark:text-red-400' : 'btn-secondary'}>
            {s === 'confirmado' && 'Confirmar pedido'}
            {s === 'cancelado' && 'Cancelar pedido'}
          </button>
        ))}
      </div>
    </div>
  );
}

function LoadingSpinnerInline() {
  return (
    <svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
