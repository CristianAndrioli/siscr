import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { PessoaBusca } from '../../components/PessoaBusca';
import { produtosService, type Produto } from '../../services/cadastros/produtos';
import { pessoasService, type Pessoa } from '../../services/cadastros/pessoas';
import {
  vendasService, STATUS_LABEL, PROXIMOS_STATUS,
  type Pedido, type PedidoItemRow, type PedidoItemInput, type PedidoStatus, type PedidoTipo,
} from '../../services/vendas';
import { fmtBRL } from '../../utils/format';
import { formatApiError } from '../../utils/helpers';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

interface EmpresaRow { id: string; razao_social: string }
interface FilialRow { id: string; nome: string; empresa_id: string }

const emptyItem = (): PedidoItemInput => ({ produtoId: '', quantidade: 1, precoUnitario: 0, desconto: 0 });

export default function PedidoVendaDetail() {
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
  const [vendedores, setVendedores] = useState<Pessoa[]>([]);

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [itensExistentes, setItensExistentes] = useState<PedidoItemRow[]>([]);

  const [empresaId, setEmpresaId] = useState('');
  const [filialId, setFilialId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [tipo, setTipo] = useState<PedidoTipo>('pedido');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<PedidoItemInput[]>([emptyItem()]);
  const [vencimentoFaturamento, setVencimentoFaturamento] = useState('');

  const podeEditar = isNew || pedido?.status === 'rascunho';

  useEffect(() => {
    api.get('/tenant/info/empresas').then(r => setEmpresas(r.data?.empresas ?? [])).catch(() => {});
    api.get('/tenant/info/filiais').then(r => setFiliais(r.data?.filiais ?? [])).catch(() => {});
    pessoasService.list({ tipoCadastro: 'vendedor', limit: 200 }).then(r => setVendedores(r.pessoas)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!empresaId) { setProdutos([]); return; }
    produtosService.list({ limit: 200 }).then(r => setProdutos(r.produtos)).catch(() => {});
  }, [empresaId]);

  const carregarPedido = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    try {
      const { pedido: p, itens: its } = await vendasService.get(id);
      setPedido(p);
      setItensExistentes(its);
      setEmpresaId(p.empresa_id);
      setFilialId(p.filial_id ?? '');
      setClienteId(p.cliente_id);
      setVendedorId(p.vendedor_id ?? '');
      setTipo(p.tipo);
      setObservacoes(p.observacoes ?? '');
      setItens(its.map(it => ({ produtoId: it.produto_id, quantidade: it.quantidade, precoUnitario: it.preco_unitario, desconto: it.desconto })));
    } catch {
      setError('Erro ao carregar pedido.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => { carregarPedido(); }, [carregarPedido]);

  const filiaisDaEmpresa = filiais.filter(f => f.empresa_id === empresaId);

  const setItemField = (idx: number, field: keyof PedidoItemInput, value: string | number) => {
    setItens(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, [field]: value };
      if (field === 'produtoId') {
        const prod = produtos.find(p => p.id === value);
        if (prod) next.precoUnitario = prod.preco_venda;
      }
      return next;
    }));
  };

  const addItem = () => setItens(prev => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItens(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);

  const total = itens.reduce((s, it) => s + (it.quantidade * it.precoUnitario) - it.desconto, 0);

  const itensValidos = itens.filter(it => it.produtoId && it.quantidade > 0);

  const handleSalvar = async () => {
    setError('');
    if (!empresaId || !clienteId) { setError('Selecione empresa e cliente.'); return; }
    if (itensValidos.length === 0) { setError('Adicione ao menos um item.'); return; }
    setSaving(true);
    try {
      if (isNew) {
        const r = await vendasService.create({ empresaId, filialId: filialId || undefined, clienteId, vendedorId: vendedorId || undefined, tipo, observacoes: observacoes || undefined, itens: itensValidos });
        navigate(`/vendas-crm/pedidos/${r.id}`);
      } else if (id) {
        await vendasService.update(id, { clienteId, vendedorId: vendedorId || null, tipo, observacoes: observacoes || null as unknown as string, itens: itensValidos });
        await carregarPedido();
      }
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao salvar o pedido.');
      reportError(msg, err, 'Pedido de Venda');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleTransicao = async (novoStatus: PedidoStatus) => {
    if (!id) return;
    if (novoStatus === 'cancelado' && !window.confirm('Cancelar este pedido? Estoque baixado será estornado.')) return;
    setSaving(true);
    setError('');
    try {
      const extra = novoStatus === 'faturado' && vencimentoFaturamento ? { vencimentoTitulo: vencimentoFaturamento } : undefined;
      await vendasService.updateStatus(id, novoStatus, extra);
      await carregarPedido();
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao atualizar status do pedido.');
      reportError(msg, err, 'Pedido de Venda');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConverter = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const r = await vendasService.converterEmPedido(id);
      navigate(`/vendas-crm/pedidos/${r.id}`);
    } catch (err) {
      setError(formatApiError(err, 'Erro ao converter orçamento em pedido.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-64"><LoadingSpinnerInline /></div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => navigate('/vendas-crm/pedidos')} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            Pedidos de Venda
          </button>
          <h1 className="text-2xl font-bold font-display text-slate-800 dark:text-slate-100">
            {isNew ? 'Novo Pedido' : `${tipo === 'orcamento' ? 'Orçamento' : 'Pedido'} nº ${pedido?.numero}`}
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
            <label className="input-label">Filial <span className="font-normal text-slate-400 dark:text-slate-500">(opcional)</span></label>
            <select className="input" value={filialId} disabled={!podeEditar || !empresaId} onChange={e => setFilialId(e.target.value)}>
              <option value="">Matriz</option>
              {filiaisDaEmpresa.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Sem filial, o pedido é da matriz.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="input-label">Cliente</label>
            {podeEditar ? (
              <PessoaBusca value={clienteId} displayValue={clienteNome} tipoCadastro="cliente" onChange={(cid, nome) => { setClienteId(cid); setClienteNome(nome); }} />
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-200 py-2">{clienteNome || '—'}</p>
            )}
          </div>
          <div>
            <label className="input-label">Tipo</label>
            <select className="input" value={tipo} disabled={!isNew} onChange={e => setTipo(e.target.value as PedidoTipo)}>
              <option value="pedido">Pedido</option>
              <option value="orcamento">Orçamento</option>
            </select>
          </div>
          <div>
            <label className="input-label">Vendedor</label>
            <select className="input" value={vendedorId} disabled={!podeEditar} onChange={e => setVendedorId(e.target.value)}>
              <option value="">Sem vendedor</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
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
                <select className="input col-span-5" value={it.produtoId} onChange={e => setItemField(idx, 'produtoId', e.target.value)}>
                  <option value="">Produto…</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.codigo} — {p.descricao}</option>)}
                </select>
                <input type="number" min={0.01} step="0.01" className="input col-span-2" placeholder="Qtd" value={it.quantidade || ''} onChange={e => setItemField(idx, 'quantidade', Number(e.target.value))} />
                <input type="number" min={0} step="0.01" className="input col-span-2" placeholder="Preço" value={it.precoUnitario || ''} onChange={e => setItemField(idx, 'precoUnitario', Number(e.target.value))} />
                <input type="number" min={0} step="0.01" className="input col-span-2" placeholder="Desconto" value={it.desconto || ''} onChange={e => setItemField(idx, 'desconto', Number(e.target.value))} />
                <button type="button" onClick={() => removeItem(idx)} className="col-span-1 text-slate-400 hover:text-red-500 flex justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead><tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[11px] uppercase text-slate-400 dark:text-slate-500">
              <th className="py-2">Produto</th><th className="py-2 text-right">Qtd</th><th className="py-2 text-right">Preço</th><th className="py-2 text-right">Desconto</th><th className="py-2 text-right">Subtotal</th>
            </tr></thead>
            <tbody>
              {itensExistentes.map(it => (
                <tr key={it.id} className="border-b border-slate-100 dark:border-slate-800/60">
                  <td className="py-2">{it.produto_codigo} — {it.produto_descricao}</td>
                  <td className="py-2 text-right font-mono">{it.quantidade}</td>
                  <td className="py-2 text-right font-mono">{fmtBRL(it.preco_unitario)}</td>
                  <td className="py-2 text-right font-mono">{fmtBRL(it.desconto)}</td>
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

      <div className="flex flex-wrap items-center gap-3">
        {podeEditar && (
          <button onClick={handleSalvar} disabled={saving} className="btn-primary">
            {saving ? 'Salvando…' : isNew ? 'Criar pedido' : 'Salvar alterações'}
          </button>
        )}

        {pedido && pedido.tipo === 'orcamento' && ['rascunho', 'confirmado'].includes(pedido.status) && (
          <button onClick={handleConverter} disabled={saving} className="btn-secondary">Converter em pedido</button>
        )}

        {pedido && PROXIMOS_STATUS[pedido.status].map(s => (
          <div key={s} className="flex items-center gap-2">
            {s === 'faturado' && (
              <input type="date" className="input w-auto" value={vencimentoFaturamento} onChange={e => setVencimentoFaturamento(e.target.value)} title="Vencimento do título (opcional, padrão +30 dias)" />
            )}
            <button onClick={() => handleTransicao(s)} disabled={saving} className={s === 'cancelado' ? 'btn-secondary text-red-600 dark:text-red-400' : 'btn-secondary'}>
              {s === 'confirmado' && 'Confirmar'}
              {s === 'faturado' && 'Faturar'}
              {s === 'entregue' && 'Marcar como entregue'}
              {s === 'cancelado' && 'Cancelar pedido'}
            </button>
          </div>
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
