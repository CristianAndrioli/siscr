import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import * as entradaService from '../../services/entradaService';
import { fmtBRL, fmtDate } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

const STEPS = [
  { id: 0, title: 'Arquivo', subtitle: 'XML da NF-e e empresa destinatária' },
  { id: 1, title: 'Fiscal', subtitle: 'Emitente, totais e validação' },
  { id: 2, title: 'Produtos', subtitle: 'Vincule cada item ao cadastro ou crie automaticamente' },
  { id: 3, title: 'Conferência', subtitle: 'Revise e confirme a importação' },
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
    };
    sugestoes: SugestaoRow[];
    assinatura_valida: boolean;
    fornecedor_id: string | null;
  } | null>(null);
  /** Por item: valor do select = id do produto ou CRIAR */
  const [vinculoSelect, setVinculoSelect] = useState<Record<number, string>>({});
  const [error, setError] = useState('');

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
      const sel: Record<number, string> = {};
      for (const s of data.sugestoes as SugestaoRow[]) {
        sel[s.indice] = s.produtoId ?? CRIAR;
      }
      setVinculoSelect(sel);
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

  const montarVinculosConfirm = () => {
    if (!preview) return [];
    return preview.parsed.itens.map((_, i) => {
      const v = vinculoSelect[i]!;
      if (v === CRIAR) return { indice: i, criar: true as const };
      return { indice: i, produtoId: v };
    });
  };

  const handleConfirm = async () => {
    if (!preview || !file || !empresaId) return;
    setConfirmLoading(true);
    setError('');
    try {
      const xmlBase64 = await fileToBase64(file);
      const res = await entradaService.confirmarNfEntradaImport({
        xmlBase64,
        empresaId,
        filialId: filialId || null,
        vinculos: montarVinculosConfirm(),
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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
        {step === 0 && (
          <>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">XML e destinatário</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              O destinatário da NF-e deve ser o <strong>CNPJ da empresa</strong> selecionada (validação automática).
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
            {!preview.assinatura_valida && (
              <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                Assinatura digital não validada ou ausente — confira o arquivo antes de usar em produção.
              </p>
            )}
            <p className="text-xs text-slate-500">
              Fornecedor no cadastro:{' '}
              {preview.fornecedor_id ? (
                <span className="text-emerald-600 font-medium">encontrado pelo CNPJ do emitente</span>
              ) : (
                <span>vincule depois na tela da nota, se necessário para contas a pagar.</span>
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
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Conferência</h2>
            <ul className="text-sm space-y-2 text-slate-600 dark:text-slate-400">
              <li>
                • {preview.parsed.itens.length} item(ns) —{' '}
                {preview.parsed.itens.filter((_, i) => vinculoSelect[i] === CRIAR).length} novo(s) produto(s) serão
                cadastrados.
              </li>
              <li>• Total da nota: {fmtBRL(preview.parsed.valorTotal)}</li>
            </ul>
            <p className="text-xs text-slate-500">
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
              disabled={confirmLoading || !preview}
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
