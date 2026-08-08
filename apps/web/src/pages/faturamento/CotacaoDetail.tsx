import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { PessoaBusca } from '../../components/PessoaBusca';
import CurrencyInput from '../../components/common/CurrencyInput';
import {
  cotacoesService,
  type Cotacao,
  type CotacaoItem,
  type CotacaoStatus,
  type CotacaoTipo,
} from '../../services/faturamentoService';
import { fmtBRL } from '../../utils/format';
import { formatApiError } from '../../utils/helpers';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

const STATUS_LABEL: Record<CotacaoStatus, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  aprovada: 'Aprovada',
  recusada: 'Recusada',
  expirada: 'Expirada',
};

interface EmpresaRow {
  id: string;
  razao_social: string;
}
interface FilialRow {
  id: string;
  nome: string;
  empresa_id: string;
}
interface Produto {
  id: string;
  descricao: string;
  codigo: string;
  unidade: string;
  preco_venda: number;
}

const emptyItem = (): CotacaoItem => ({
  descricao: '',
  quantidade: 1,
  valorUnitario: 0,
  desconto: 0,
  unidade: 'UN',
});

function normalizeItem(i: CotacaoItem & Record<string, unknown>): CotacaoItem {
  return {
    id: i.id,
    produtoId: i.produtoId ?? (i.produto_id as string | undefined),
    servicoId: i.servicoId ?? (i.servico_id as string | undefined),
    descricao: i.descricao ?? '',
    quantidade: Number(i.quantidade) || 0,
    valorUnitario: Number(i.valorUnitario ?? i.valor_unitario) || 0,
    desconto: Number(i.desconto) || 0,
    valor_total: i.valor_total,
    unidade: i.unidade ?? 'UN',
  };
}

export default function CotacaoDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = id === 'nova' || id === 'novo';
  const { reportError } = useErrorNotification();

  const tipo: CotacaoTipo = location.pathname.startsWith('/compras/') ? 'compra' : 'venda';
  const listPath = tipo === 'compra' ? '/compras/cotacoes' : '/faturamento/cotacoes';
  const pessoaLabel = tipo === 'compra' ? 'Fornecedor' : 'Cliente';
  const tipoCadastroPessoa = tipo === 'compra' ? 'fornecedor' : 'cliente';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cotacao, setCotacao] = useState<Cotacao | null>(null);

  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [filiais, setFiliais] = useState<FilialRow[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  const [empresaId, setEmpresaId] = useState('');
  const [filialId, setFilialId] = useState('');
  const [pessoaId, setPessoaId] = useState('');
  const [pessoaNome, setPessoaNome] = useState('');
  const [validade, setValidade] = useState('');
  const [status, setStatus] = useState<CotacaoStatus>('rascunho');
  const [observacoes, setObservacoes] = useState('');
  const [desconto, setDesconto] = useState(0);
  const [itens, setItens] = useState<CotacaoItem[]>([emptyItem()]);

  useEffect(() => {
    api
      .get('/tenant/info/empresas')
      .then((r) => {
        const list = (r.data.empresas ?? []) as EmpresaRow[];
        setEmpresas(list);
        if (isNew && list[0]) setEmpresaId((prev) => prev || list[0]!.id);
      })
      .catch(() => {});
    api
      .get('/tenant/info/filiais')
      .then((r) => setFiliais((r.data.filiais ?? []) as FilialRow[]))
      .catch(() => {});
  }, [isNew]);

  useEffect(() => {
    if (!empresaId) return;
    api
      .get('/tenant/cadastros/produtos', { params: { empresaId, limit: 200, page: 0 } })
      .then((r) => setProdutos(r.data.produtos ?? []))
      .catch(() => setProdutos([]));
  }, [empresaId]);

  const carregar = useCallback(async () => {
    if (isNew || !id) return;
    setLoading(true);
    setError('');
    try {
      const c = await cotacoesService.get(id);
      setCotacao(c);
      setEmpresaId(c.empresa_id ?? '');
      setFilialId(c.filial_id ?? '');
      setPessoaId(c.pessoa_id ?? '');
      setPessoaNome(c.cliente ?? '');
      setValidade(c.validade ?? '');
      setStatus(c.status);
      setObservacoes(c.observacoes ?? '');
      setDesconto(c.desconto ?? 0);
      setItens(
        c.itens && c.itens.length > 0
          ? c.itens.map((i) => normalizeItem(i as CotacaoItem & Record<string, unknown>))
          : [emptyItem()],
      );
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao carregar cotação.');
      reportError(msg, err, 'Cotação');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, isNew, reportError]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const filiaisDaEmpresa = useMemo(
    () => filiais.filter((f) => f.empresa_id === empresaId),
    [filiais, empresaId],
  );

  const calcItemTotal = (item: CotacaoItem) =>
    item.quantidade * item.valorUnitario - (item.desconto ?? 0);
  const subtotal = itens.reduce((s, i) => s + calcItemTotal(i), 0);
  const totalFinal = subtotal - desconto;

  const setItem = (idx: number, field: keyof CotacaoItem, value: string | number) =>
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));

  const fillFromProduto = (idx: number, prodId: string) => {
    const p = produtos.find((x) => x.id === prodId);
    if (!p) return;
    setItens((prev) =>
      prev.map((it, i) =>
        i === idx
          ? {
              ...it,
              produtoId: p.id,
              descricao: p.descricao,
              valorUnitario: p.preco_venda ?? 0,
              unidade: p.unidade ?? 'UN',
            }
          : it,
      ),
    );
  };

  const handleSalvar = async () => {
    setError('');
    const validItens = itens.filter((i) => i.descricao.trim());
    if (!empresaId) {
      setError('Selecione a empresa.');
      return;
    }
    if (validItens.length === 0) {
      setError('Adicione pelo menos um item.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tipo,
        empresa_id: empresaId,
        filial_id: filialId || null,
        pessoa_id: pessoaId || undefined,
        validade: validade || undefined,
        observacoes: observacoes || undefined,
        desconto,
        status,
        itens: validItens,
      };
      if (isNew) {
        const r = await cotacoesService.create(payload as Parameters<typeof cotacoesService.create>[0]);
        navigate(`${listPath}/${r.id}`, { replace: true });
      } else if (id) {
        await cotacoesService.update(id, payload as Parameters<typeof cotacoesService.update>[1]);
        await carregar();
      }
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao salvar cotação.');
      reportError(msg, err, 'Cotação');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleFaturar = () => {
    if (!id || isNew) return;
    navigate(`/faturamento/nf-venda/nova?cotacaoId=${id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="animate-spin w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <button
            type="button"
            onClick={() => navigate(listPath)}
            className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            {tipo === 'compra' ? 'Cotações de Fornecedores' : 'Cotações'}
          </button>
          <h1 className="text-2xl font-bold font-display text-slate-800 dark:text-slate-100">
            {isNew ? 'Nova Cotação' : `Cotação ${cotacao?.numero ?? ''}`}
          </h1>
          {!isNew && id && (
            <p className="text-xs text-slate-400 font-mono mt-1 break-all">ID {id}</p>
          )}
        </div>
        {cotacao && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 self-start">
            {STATUS_LABEL[cotacao.status]}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          Dados gerais
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Empresa
            </label>
            <select
              value={empresaId}
              onChange={(e) => {
                setEmpresaId(e.target.value);
                setFilialId('');
              }}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
            >
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.razao_social}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Filial <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <select
              value={filialId}
              onChange={(e) => setFilialId(e.target.value)}
              disabled={!empresaId}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
            >
              <option value="">Matriz</option>
              {filiaisDaEmpresa.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Sem filial, a cotação é da matriz.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {pessoaLabel}
            </label>
            <PessoaBusca
              value={pessoaId}
              displayValue={pessoaNome}
              onChange={(pid, nome) => {
                setPessoaId(pid);
                setPessoaNome(nome);
              }}
              tipoCadastro={tipoCadastroPessoa}
              placeholder={`Buscar ${pessoaLabel.toLowerCase()} por nome ou CPF/CNPJ...`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Validade
            </label>
            <input
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CotacaoStatus)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
            >
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Itens
          </p>
          <button
            type="button"
            onClick={() => setItens((prev) => [...prev, emptyItem()])}
            className="text-xs text-brand-600 dark:text-brand-400 font-medium hover:underline"
          >
            + Adicionar item
          </button>
        </div>
        <div className="space-y-2">
          {itens.map((item, idx) => (
            <div key={idx} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 space-y-2">
              <div className="flex gap-2">
                <select
                  onChange={(e) => fillFromProduto(idx, e.target.value)}
                  value={item.produtoId ?? ''}
                  className="border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-700 dark:text-slate-100 min-w-[150px]"
                >
                  <option value="">Selec. produto...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} — {p.descricao}
                    </option>
                  ))}
                </select>
                <input
                  value={item.descricao}
                  onChange={(e) => setItem(idx, 'descricao', e.target.value)}
                  placeholder="Descrição do item *"
                  className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100"
                />
                {itens.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItens((prev) => prev.filter((_, i) => i !== idx))}
                    className="text-red-400 hover:text-red-600 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Qtd.</label>
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={item.quantidade}
                    onChange={(e) => setItem(idx, 'quantidade', parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Unid.</label>
                  <input
                    value={item.unidade}
                    onChange={(e) => setItem(idx, 'unidade', e.target.value.toUpperCase())}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Vlr. Unit.</label>
                  <CurrencyInput
                    value={item.valorUnitario}
                    onChange={(v) => setItem(idx, 'valorUnitario', v)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 text-right tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 dark:text-slate-400 block mb-0.5">Desc. item</label>
                  <CurrencyInput
                    value={item.desconto}
                    onChange={(v) => setItem(idx, 'desconto', v)}
                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 text-right tabular-nums"
                  />
                </div>
              </div>
              <div className="text-right text-xs font-bold text-slate-600 dark:text-slate-300">
                Subtotal item: {fmtBRL(calcItemTotal(item))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="grid sm:grid-cols-2 gap-4 items-start">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              placeholder="Condições comerciais, prazo de entrega..."
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 resize-none"
            />
          </div>
          <div className="flex flex-col gap-2 text-sm pt-1">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Subtotal:</span>
              <span>{fmtBRL(subtotal)}</span>
            </div>
            <div className="flex justify-between items-center gap-2">
              <span className="text-slate-500 dark:text-slate-400 whitespace-nowrap">Desconto geral:</span>
              <CurrencyInput
                value={desconto}
                onChange={setDesconto}
                className="w-28 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 text-right tabular-nums"
              />
            </div>
            <div className="flex justify-between font-bold text-base border-t border-slate-200 dark:border-slate-700 pt-2 text-slate-800 dark:text-slate-100">
              <span>Total:</span>
              <span className="text-brand-600 dark:text-brand-400">{fmtBRL(totalFinal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {tipo === 'venda' && !isNew && status === 'aprovada' && (
          <button
            type="button"
            onClick={handleFaturar}
            className="px-4 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
          >
            Faturar NF-e
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => navigate(listPath)}
          className="px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={handleSalvar}
          disabled={saving}
          className="px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar Cotação'}
        </button>
      </div>
    </div>
  );
}
