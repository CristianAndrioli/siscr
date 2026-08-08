import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import * as entradaService from '../../services/entradaService';
import { fmtBRL, fmtDate } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

const STEPS = [
  { id: 0, title: 'Arquivo', subtitle: 'XML da NF-e e empresa destinatária' },
  { id: 1, title: 'Fiscal', subtitle: 'Emitente, totais e validação' },
  { id: 2, title: 'Produtos', subtitle: 'Vincule cada item ao cadastro ou crie automaticamente' },
  { id: 3, title: 'Pedido de compra', subtitle: 'Baixa do saldo e conferência de divergências' },
  { id: 4, title: 'Conferência', subtitle: 'Revise e confirme a importação' },
] as const;

interface EmpresaRow {
  id: string;
  razao_social: string;
  cnpj?: string;
}

interface FilialRow {
  id: string;
  nome: string;
  empresa_id: string;
}

interface ProdutoOpt {
  id: string;
  descricao: string;
  codigo: string;
  sku?: string | null;
}

interface ItemXml {
  nItem: number;
  cProd?: string;
  cEAN?: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  cfop?: string;
  ncm?: string;
  unidade?: string;
  /** Número do pedido de compra informado pelo fornecedor no XML. */
  xPed?: string;
  /** Item do pedido de compra correspondente, informado no XML. */
  nItemPed?: number;
}

interface SugestaoRow {
  indice: number;
  produtoId: string | null;
  motivo: string;
  rotulo?: string;
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

const CRIAR = '__criar__';

export default function NfEntradaWizardPage() {
  const navigate = useNavigate();
  const { reportError } = useErrorNotification();
  const [step, setStep] = useState(0);
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [filiais, setFiliais] = useState<FilialRow[]>([]);
  const [produtos, setProdutos] = useState<ProdutoOpt[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [filialId, setFilialId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [preview, setPreview] = useState<{
    parsed: {
      chaveAcesso: string;
      emitenteCnpj: string;
      emitenteNome: string;
      dataEmissao: string;
      numero: number;
      serie: string;
      naturezaOperacao: string;
      valorTotal: number;
      valorProdutos: number;
      itens: ItemXml[];
      modelo?: number;
      destinatarioAusente?: boolean;
    };
    sugestoes: SugestaoRow[];
    assinatura_valida: boolean;
    fornecedor_id: string | null;
    fornecedor_sera_cadastrado?: boolean;
    nfce_sem_dest?: boolean;
    numero_pedido_xml?: number | null;
    pedido_sugerido?: entradaService.PedidoCompraComItens | null;
    pedido_origem?: 'xped' | 'unico_aberto' | null;
    pedidos_abertos?: entradaService.PedidoCompraResumo[];
  } | null>(null);
  /** Confirmação explícita para NFC-e sem CNPJ do destinatário no XML (issue #13 / cupom). */
  const [confirmarDestinoNfce, setConfirmarDestinoNfce] = useState(false);
  /** Por item: valor do select = id do produto ou CRIAR */
  const [vinculoSelect, setVinculoSelect] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

  /** Pedido de compra que a nota vai baixar ('' = importar sem vínculo). */
  const [pedidoId, setPedidoId] = useState('');
  const [pedido, setPedido] = useState<entradaService.PedidoCompraComItens | null>(null);
  const [vinculosPedido, setVinculosPedido] = useState<entradaService.VinculoItemPedido[]>([]);
  const [divergencias, setDivergencias] = useState<entradaService.DivergenciaVinculo[]>([]);
  const [avaliandoPedido, setAvaliandoPedido] = useState(false);
  /** Só os itens que o usuário mexeu — os demais seguem o casamento automático. */
  const [overridesPedido, setOverridesPedido] = useState<Record<number, string | null>>({});
  /**
   * Produtos escolhidos no passo anterior na última avaliação. O casamento por
   * produto depende deles, então uma troca lá invalida o que foi calculado aqui.
   */
  const assinaturaAvaliada = useRef<string | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const [eRes, fRes] = await Promise.all([
        api.get('/tenant/info/empresas'),
        api.get('/tenant/info/filiais'),
      ]);
      const elist = (eRes.data.empresas ?? []) as EmpresaRow[];
      setEmpresas(elist);
      setFiliais((fRes.data.filiais ?? []) as FilialRow[]);
      setEmpresaId((prev) => prev || elist[0]?.id || '');
    } catch {
      setError('Não foi possível carregar empresas.');
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!empresaId) return;
    let cancelled = false;
    api
      .get('/tenant/cadastros/produtos', { params: { empresaId, limit: 500, page: 0 } })
      .then((r) => {
        if (!cancelled) setProdutos((r.data.produtos ?? []) as ProdutoOpt[]);
      })
      .catch(() => {
        if (!cancelled) setProdutos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [empresaId]);

  const filiaisDaEmpresa = useMemo(() => filiais.filter((f) => f.empresa_id === empresaId), [filiais, empresaId]);

  const handlePreview = async () => {
    if (!file || !empresaId) {
      setError('Selecione o XML e a empresa.');
      return;
    }
    setPreviewLoading(true);
    setError('');
    try {
      const data = await entradaService.previewNfEntradaXml(file, empresaId);
      setPreview(data as typeof preview);
      setConfirmarDestinoNfce(false);
      const sel: Record<number, string> = {};
      for (const s of data.sugestoes as SugestaoRow[]) {
        sel[s.indice] = s.produtoId ?? CRIAR;
      }
      setVinculoSelect(sel);
      assinaturaAvaliada.current = JSON.stringify(sel);
      setOverridesPedido({});
      setPedidoId(data.pedido_sugerido?.id ?? '');
      setPedido(data.pedido_sugerido ?? null);
      setVinculosPedido(data.vinculos_pedido ?? []);
      setDivergencias(data.divergencias ?? []);
      setStep(1);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Falha ao analisar o XML.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const vinculosValidos = useMemo(() => {
    if (!preview) return false;
    return preview.parsed.itens.every((_, i) => {
      const v = vinculoSelect[i];
      return v && (v === CRIAR || v.length > 10);
    });
  }, [preview, vinculoSelect]);

  const itemPedidoDoIndice = useCallback(
    (i: number) => vinculosPedido.find((v) => v.indice === i)?.itemPedidoId ?? null,
    [vinculosPedido],
  );

  const montarVinculosConfirm = () => {
    if (!preview) return [];
    return preview.parsed.itens.map((_, i) => {
      const v = vinculoSelect[i]!;
      const itemPedidoId = pedidoId ? itemPedidoDoIndice(i) : null;
      if (v === CRIAR) return { indice: i, criar: true as const, itemPedidoId };
      return { indice: i, produtoId: v, itemPedidoId };
    });
  };

  /**
   * Recalcula o casamento na API. Manter a regra num lugar só evita que a tela e
   * o servidor discordem sobre o que é divergência.
   */
  const reavaliarPedido = useCallback(
    async (alvoPedidoId: string, overrides: Record<number, string | null>) => {
      if (!preview || !alvoPedidoId) {
        setPedido(null);
        setVinculosPedido([]);
        setDivergencias([]);
        return;
      }
      setAvaliandoPedido(true);
      try {
        const r = await entradaService.avaliarVinculoPedido({
          pedidoCompraId: alvoPedidoId,
          itens: preview.parsed.itens.map((it, i) => {
            const sel = vinculoSelect[i];
            return {
              descricao: it.descricao,
              quantidade: it.quantidade,
              valorUnitario: it.valorUnitario,
              nItemPed: it.nItemPed,
              produtoId: sel && sel !== CRIAR ? sel : null,
            };
          }),
          overrides: Object.entries(overrides).map(([indice, itemPedidoId]) => ({
            indice: Number(indice),
            itemPedidoId,
          })),
        });
        setPedido(r.pedido);
        setVinculosPedido(r.vinculos_pedido);
        setDivergencias(r.divergencias);
      } catch (e: unknown) {
        const ax = e as { response?: { data?: { error?: string } } };
        reportError(ax.response?.data?.error || 'Não foi possível avaliar o pedido de compra.');
      } finally {
        setAvaliandoPedido(false);
      }
    },
    [preview, vinculoSelect, reportError],
  );

  const handleTrocarPedido = (novoId: string) => {
    setPedidoId(novoId);
    setOverridesPedido({});
    void reavaliarPedido(novoId, {});
  };

  const handleTrocarItemPedido = (indice: number, itemPedidoId: string | null) => {
    const proximos = { ...overridesPedido, [indice]: itemPedidoId };
    setOverridesPedido(proximos);
    void reavaliarPedido(pedidoId, proximos);
  };

  const assinaturaProdutos = useMemo(() => JSON.stringify(vinculoSelect), [vinculoSelect]);

  useEffect(() => {
    if (step !== 3 || !pedidoId) return;
    if (assinaturaAvaliada.current === assinaturaProdutos) return;
    assinaturaAvaliada.current = assinaturaProdutos;
    void reavaliarPedido(pedidoId, overridesPedido);
  }, [step, pedidoId, assinaturaProdutos, overridesPedido, reavaliarPedido]);

  const divergenciasPorIndice = useMemo(() => {
    const mapa = new Map<number, entradaService.DivergenciaVinculo[]>();
    for (const d of divergencias) {
      const atual = mapa.get(d.indice) ?? [];
      atual.push(d);
      mapa.set(d.indice, atual);
    }
    return mapa;
  }, [divergencias]);

  const temBloqueio = useMemo(() => divergencias.some((d) => d.bloqueia), [divergencias]);

  const handleConfirm = async () => {
    if (!preview || !file || !empresaId) return;
    if (preview.nfce_sem_dest && !confirmarDestinoNfce) {
      setError(
        'Marque a confirmação de que esta compra é da empresa selecionada. NFC-e em cupom costuma não trazer o CNPJ do destinatário no XML.',
      );
      return;
    }
    setConfirmLoading(true);
    setError('');
    try {
      const xmlBase64 = await fileToBase64(file);
      const res = await entradaService.confirmarNfEntradaImport({
        xmlBase64,
        empresaId,
        filialId: filialId || null,
        vinculos: montarVinculosConfirm(),
        pedidoCompraId: pedidoId || null,
        confirmarDestinoEmpresa: preview.nfce_sem_dest ? confirmarDestinoNfce : undefined,
      });
      navigate(`/entrada/notas/${res.id}`);
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      reportError(ax.response?.data?.error || 'Erro ao confirmar importação.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const canNext = (): boolean => {
    if (step === 0) return Boolean(file && empresaId);
    if (step === 1) return Boolean(preview);
    if (step === 2) return vinculosValidos;
    if (step === 3) return !avaliandoPedido && !temBloqueio;
    return true;
  };

  const motivoLabel = (m: string) => {
    const map: Record<string, string> = {
      sku: 'SKU = cProd do fornecedor',
      codigo: 'Código interno = cProd',
      ean: 'EAN/GTIN',
      none: 'Sem correspondência automática',
    };
    return map[m] || m;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div>
        <Link
          to="/entrada/notas"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Notas importadas
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Importar NF-e de entrada</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Fluxo em etapas, como na emissão de NF-e: primeiro o arquivo fiscal, depois o vínculo de cada produto com o seu
          cadastro (SKU/código/EAN). Itens sem par podem ser criados automaticamente.
        </p>
      </div>

      <nav aria-label="Progresso" className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => i <= step && setStep(i)}
            className={`flex-1 min-w-[140px] text-left rounded-xl border px-3 py-2.5 transition-colors ${
              i === step
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-950/40 ring-1 ring-brand-500/30'
                : i < step
                  ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 opacity-70'
            }`}
          >
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Passo {i + 1}</span>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.title}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{s.subtitle}</p>
          </button>
        ))}
      </nav>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
        {step === 0 && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">XML e destinatário</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Em NF-e de compra (modelo 55), o destinatário no XML deve ser o <strong>CNPJ da empresa</strong> selecionada.
              Cupons NFC-e (modelo 65) muitas vezes não trazem o destinatário — nesse caso o sistema pedirá confirmação nas
              etapas seguintes.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Empresa</span>
                <select
                  value={empresaId}
                  onChange={(e) => {
                    setEmpresaId(e.target.value);
                    setFilialId('');
                  }}
                  className="mt-1 w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.razao_social}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Filial (opcional)</span>
                <select
                  value={filialId}
                  onChange={(e) => setFilialId(e.target.value)}
                  className="mt-1 w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800"
                >
                  <option value="">—</option>
                  {filiaisDaEmpresa.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Arquivo XML (NF-e autorizada)</span>
              <input
                type="file"
                accept=".xml,application/xml,text/xml"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm text-slate-600 dark:text-slate-400"
              />
            </label>
            <button
              type="button"
              disabled={previewLoading || !file}
              onClick={handlePreview}
              className="px-5 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {previewLoading ? 'Analisando…' : 'Analisar XML'}
            </button>
          </>
        )}

        {step === 1 && preview && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Dados fiscais</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <dt className="text-slate-500">Emitente</dt>
                <dd className="font-medium text-right">{preview.parsed.emitenteNome || preview.parsed.emitenteCnpj}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <dt className="text-slate-500">NF / Série</dt>
                <dd className="font-medium text-right">
                  {preview.parsed.numero} / {preview.parsed.serie}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <dt className="text-slate-500">Emissão</dt>
                <dd className="font-medium text-right">{fmtDate(preview.parsed.dataEmissao)}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                <dt className="text-slate-500">Total</dt>
                <dd className="font-bold text-right text-brand-600">{fmtBRL(preview.parsed.valorTotal)}</dd>
              </div>
              <div className="pt-1">
                <dt className="text-slate-500 text-xs mb-1">Chave de acesso</dt>
                <dd className="font-mono text-xs break-all text-slate-600 dark:text-slate-400">{preview.parsed.chaveAcesso}</dd>
              </div>
            </dl>
            {preview.parsed.modelo !== undefined && (
              <p className="text-xs text-slate-500">
                Modelo fiscal: <span className="font-mono">{preview.parsed.modelo}</span>
                {preview.parsed.modelo === 65 ? ' (NFC-e)' : ''}
              </p>
            )}
            {preview.nfce_sem_dest && (
              <p className="text-sm text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                Este XML é <strong>NFC-e</strong> e não identifica o destinatário (CNPJ). Para importar, você precisará
                confirmar na etapa final que a compra é da empresa selecionada. O CNPJ gravado na nota será o da empresa.
              </p>
            )}
            {!preview.assinatura_valida && (
              <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                Assinatura digital não validada ou ausente — confira o arquivo antes de usar em produção.
              </p>
            )}
            <p className="text-xs text-slate-500">
              Fornecedor (emitente):{' '}
              {preview.fornecedor_id ? (
                <span className="text-emerald-600 font-medium">já cadastrado pelo CNPJ do emitente</span>
              ) : preview.fornecedor_sera_cadastrado ? (
                <span className="text-amber-700 dark:text-amber-300">
                  será criado automaticamente ao confirmar (contas a pagar e estoque usam esse cadastro)
                </span>
              ) : (
                <span>—</span>
              )}
            </p>
          </>
        )}

        {step === 2 && preview && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Produtos do XML</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Padrão de mercado: casar <strong>cProd</strong> com <strong>SKU</strong> ou <strong>código</strong>, ou o{' '}
              <strong>EAN</strong>. Se não houver correspondência, use &quot;Criar novo produto&quot; — o sistema cadastra
              com preço de custo da nota.
            </p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">XML (cProd / descrição)</th>
                    <th className="px-3 py-2">Sugestão</th>
                    <th className="px-3 py-2 min-w-[220px]">Produto no sistema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {preview.parsed.itens.map((it, idx) => {
                    const sug = preview.sugestoes.find((s) => s.indice === idx);
                    return (
                      <tr key={idx}>
                        <td className="px-3 py-2 align-top">{it.nItem}</td>
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium text-slate-800 dark:text-slate-100">{it.descricao}</div>
                          <div className="text-xs text-slate-500">
                            cProd: {it.cProd || '—'} · Qtd {it.quantidade} · {fmtBRL(it.valorTotal)}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-600">
                          {sug?.produtoId ? (
                            <>
                              <span className="text-emerald-600 font-medium">Match: {motivoLabel(sug.motivo)}</span>
                              {sug.rotulo && <div className="truncate max-w-[140px]">{sug.rotulo}</div>}
                            </>
                          ) : (
                            <span>{motivoLabel(sug?.motivo || 'none')}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            value={vinculoSelect[idx] ?? CRIAR}
                            onChange={(e) => setVinculoSelect((m) => ({ ...m, [idx]: e.target.value }))}
                            className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800"
                          >
                            <option value={CRIAR}>Criar novo produto (automático)</option>
                            {produtos.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.codigo} — {p.descricao.slice(0, 40)}
                                {p.sku ? ` (SKU ${p.sku})` : ''}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {step === 3 && preview && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Pedido de compra</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Quando o fornecedor preenche a tag <strong>xPed</strong> no XML, o pedido é localizado sozinho. Sem ela, o
              sistema procura os pedidos em aberto deste fornecedor. Ao vincular, a nota dá baixa no saldo do pedido e a
              mercadoria entra em estoque uma única vez, pelo recebimento.
            </p>

            {preview.numero_pedido_xml ? (
              <p className="text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                O XML informa o pedido <strong>nº {preview.numero_pedido_xml}</strong> na tag xPed.
                {preview.pedido_origem === 'xped'
                  ? ' Pedido localizado e vinculado automaticamente.'
                  : ' Nenhum pedido em aberto com esse número foi encontrado para o fornecedor.'}
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                O fornecedor não informou o número do pedido no XML. Selecione manualmente se esta nota atende a algum
                pedido.
              </p>
            )}

            <label className="block">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Pedido a baixar</span>
              <select
                value={pedidoId}
                onChange={(e) => handleTrocarPedido(e.target.value)}
                disabled={avaliandoPedido}
                className="mt-1 w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 disabled:opacity-60"
              >
                <option value="">Importar sem vincular a pedido</option>
                {(preview.pedidos_abertos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    Pedido {p.numero} — {fmtBRL(p.total)} ({p.status === 'recebido_parcial' ? 'parcial' : 'confirmado'})
                  </option>
                ))}
              </select>
              {!preview.fornecedor_id && (
                <span className="text-xs text-amber-700 dark:text-amber-300 mt-1 block">
                  O fornecedor ainda não está cadastrado, então não há pedidos em aberto para listar.
                </span>
              )}
            </label>

            {pedidoId && pedido && (
              <>
                {temBloqueio && (
                  <div className="text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                    Há divergência que impede a importação com este vínculo. Desvincule o item apontado abaixo ou ajuste o
                    pedido antes de continuar.
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Item da nota</th>
                        <th className="px-3 py-2 min-w-[220px]">Item do pedido {pedido.numero}</th>
                        <th className="px-3 py-2">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {preview.parsed.itens.map((it, idx) => {
                        const vinculado = itemPedidoDoIndice(idx);
                        const itemPedido = pedido.itens.find((i) => i.id === vinculado);
                        const avisos = divergenciasPorIndice.get(idx) ?? [];
                        const origem = vinculosPedido.find((v) => v.indice === idx)?.origem;
                        return (
                          <tr key={idx}>
                            <td className="px-3 py-2 align-top">{it.nItem}</td>
                            <td className="px-3 py-2 align-top">
                              <div className="font-medium text-slate-800 dark:text-slate-100">{it.descricao}</div>
                              <div className="text-xs text-slate-500">
                                Qtd {it.quantidade} · {fmtBRL(it.valorUnitario)} un
                                {it.nItemPed ? ` · item ${it.nItemPed} do pedido (XML)` : ''}
                              </div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <select
                                value={vinculado ?? ''}
                                disabled={avaliandoPedido}
                                onChange={(e) => handleTrocarItemPedido(idx, e.target.value || null)}
                                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-800 disabled:opacity-60"
                              >
                                <option value="">Não baixar do pedido</option>
                                {pedido.itens.map((ip) => (
                                  <option key={ip.id} value={ip.id}>
                                    {ip.seq}. {(ip.produto_descricao ?? 'Produto').slice(0, 34)} — saldo {ip.saldo}
                                  </option>
                                ))}
                              </select>
                              {itemPedido && (
                                <div className="text-xs text-slate-500 mt-1">
                                  Pedido: {itemPedido.saldo} pendente(s) a {fmtBRL(itemPedido.preco_unitario)} un
                                  {origem === 'nItemPed' ? ' · casado pelo XML' : ''}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 align-top text-xs">
                              {avisos.length === 0 ? (
                                vinculado ? (
                                  <span className="text-emerald-600 font-medium">Confere com o pedido</span>
                                ) : (
                                  <span className="text-slate-500">Entra só em estoque</span>
                                )
                              ) : (
                                <ul className="space-y-1">
                                  {avisos.map((d, i) => (
                                    <li
                                      key={i}
                                      className={
                                        d.bloqueia
                                          ? 'text-red-700 dark:text-red-300 font-medium'
                                          : 'text-amber-700 dark:text-amber-300'
                                      }
                                    >
                                      {d.mensagem}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {avaliandoPedido && <p className="text-xs text-slate-500">Recalculando divergências…</p>}
              </>
            )}
          </>
        )}

        {step === 4 && preview && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Conferência</h2>
            <ul className="text-sm space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                • {preview.parsed.itens.length} item(ns) —{' '}
                {preview.parsed.itens.filter((_, i) => vinculoSelect[i] === CRIAR).length} novo(s) produto(s) serão
                cadastrados.
              </li>
              <li>• Total da nota: {fmtBRL(preview.parsed.valorTotal)}</li>
              {pedidoId && pedido ? (
                <li>
                  • Baixa no pedido <strong>{pedido.numero}</strong>:{' '}
                  {preview.parsed.itens.filter((_, i) => itemPedidoDoIndice(i)).length} de {preview.parsed.itens.length}{' '}
                  item(ns). O estoque desses itens entra pelo recebimento do pedido, sem duplicar.
                </li>
              ) : (
                <li>• Sem vínculo com pedido de compra — os itens entram direto em estoque.</li>
              )}
              {divergencias.length > 0 && (
                <li className="text-amber-700 dark:text-amber-300">
                  • {divergencias.length} divergência(s) em relação ao pedido serão registradas assim mesmo.
                </li>
              )}
            </ul>
            {preview.nfce_sem_dest && (
              <label className="flex items-start gap-3 mt-4 p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={confirmarDestinoNfce}
                  onChange={(e) => setConfirmarDestinoNfce(e.target.checked)}
                />
                <span className="text-sm text-slate-700 dark:text-slate-200">
                  Confirmo que esta NFC-e refere-se a compra da empresa selecionada e autorizo gravar o CNPJ da empresa
                  como destinatário (o arquivo não traz esse dado).
                </span>
              </label>
            )}
            <p className="text-xs text-slate-500 mt-3">
              Após confirmar, a NF-e fica registrada e os itens guardam o vínculo com o produto para estoque e relatórios.
            </p>
          </>
        )}

        <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Voltar
            </button>
          ) : (
            <Link
              to="/entrada/notas"
              className="px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center"
            >
              Cancelar
            </Link>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={!canNext()}
              onClick={() => canNext() && setStep((s) => s + 1)}
              className="px-5 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl disabled:opacity-40"
            >
              Continuar
            </button>
          ) : (
            <button
              type="button"
              disabled={
                confirmLoading ||
                !preview ||
                (Boolean(preview.nfce_sem_dest) && !confirmarDestinoNfce)
              }
              onClick={handleConfirm}
              className="px-5 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {confirmLoading ? 'Importando…' : 'Confirmar importação'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
