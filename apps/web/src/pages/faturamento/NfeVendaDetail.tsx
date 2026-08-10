import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  notasService,
  type NotaFiscal,
  type NFStatus,
  type VerificacaoAssinaturaNfe,
} from '../../services/faturamentoService';
import { fmtBRL, fmtDate } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import Tabs, { type Tab } from '../../components/common/Tabs';
import type { ErrorLogEntry } from '../../utils/errorLogger';

const STATUS_STYLE: Record<NFStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  pendente_emissao: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  autorizada: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  emitida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelada: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  inutilizada: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const STATUS_LABEL: Record<NFStatus, string> = {
  rascunho: 'Rascunho',
  pendente_emissao: 'XML gerado',
  autorizada: 'Autorizada (SEFAZ)',
  emitida: 'Faturada (ERP)',
  cancelada: 'Cancelada',
  inutilizada: 'Inutilizada',
};

type FaturarStep = { label: string; status: 'pending' | 'running' | 'done' | 'error' };
interface CondicaoPagamento {
  parcelas: number;
  vencimento: string;
  intervalo_dias: number;
}

function fmtLogWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

export default function NfeVendaDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reportError, notify } = useErrorNotification();

  const [nota, setNota] = useState<NotaFiscal | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyXml, setBusyXml] = useState(false);
  const [busyTx, setBusyTx] = useState(false);
  const [busyValidar, setBusyValidar] = useState(false);
  const [xmlToolsBusy, setXmlToolsBusy] = useState(false);
  const [assinaturaVerif, setAssinaturaVerif] = useState<VerificacaoAssinaturaNfe | null>(null);
  const [assinaturaVerifLoading, setAssinaturaVerifLoading] = useState(false);
  const [xmlValidationErrors, setXmlValidationErrors] = useState<
    { path: string; message: string }[]
  >([]);

  const [notaLogs, setNotaLogs] = useState<ErrorLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsTotal, setLogsTotal] = useState(0);

  const [modal, setModal] = useState<'faturar' | 'cancel' | null>(null);
  const [motivoCancel, setMotivoCancel] = useState('');
  const [saving, setSaving] = useState(false);
  const [faturarSteps, setFaturarSteps] = useState<FaturarStep[]>([]);
  const [faturarDone, setFaturarDone] = useState(false);
  const [faturarConfirmando, setFaturarConfirmando] = useState(false);
  const [faturarError, setFaturarError] = useState('');
  const [condicao, setCondicao] = useState<CondicaoPagamento>({
    parcelas: 1,
    vencimento: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    intervalo_dias: 30,
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const n = await notasService.get(id);
      setNota(n);
    } catch (err) {
      setNota(null);
      reportError('Erro ao carregar NF-e.', err, 'Faturamento NF-e');
    } finally {
      setLoading(false);
    }
  }, [id, reportError]);

  const loadNotaLogs = useCallback(async () => {
    if (!id) return;
    setLogsLoading(true);
    try {
      const page = await notasService.listEventos(id, { page: 0, limit: 50 });
      setNotaLogs(page.events);
      setLogsTotal(page.total);
    } catch {
      setNotaLogs([]);
      setLogsTotal(0);
    } finally {
      setLogsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!nota?.chave_acesso || !nota.id) {
      setAssinaturaVerif(null);
      return;
    }
    let cancelled = false;
    setAssinaturaVerifLoading(true);
    notasService
      .verificacaoAssinatura(nota.id)
      .then((v) => {
        if (!cancelled) setAssinaturaVerif(v);
      })
      .catch(() => {
        if (!cancelled) setAssinaturaVerif(null);
      })
      .finally(() => {
        if (!cancelled) setAssinaturaVerifLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nota?.id, nota?.chave_acesso]);

  const extractXmlErrors = (err: unknown): { path: string; message: string }[] => {
    const ax = err as {
      response?: { data?: { errors?: { path: string; message: string }[]; code?: string } };
    };
    const list = ax.response?.data?.errors;
    return Array.isArray(list) ? list : [];
  };

  const handlePrepararXml = async (force?: boolean) => {
    if (!nota) return;
    setBusyXml(true);
    setXmlValidationErrors([]);
    try {
      const r = await notasService.prepararXml(nota.id, { force });
      notify(
        r.message +
          (r.signed ? ' Assinatura digital aplicada.' : '') +
          (r.devMode ? ' (modo desenvolvimento)' : ''),
        'success',
      );
      await load();
      void loadNotaLogs();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; code?: string } } };
      setXmlValidationErrors(extractXmlErrors(err));
      if (ax.response?.data?.code === 'NFE_XML_INVALID') {
        notify(ax.response.data.error || 'XML inválido no leiaute — corrija e regenere.', 'warning');
      } else {
        reportError('Erro ao gerar XML da NF-e.', err, 'Faturamento NF-e');
        void loadNotaLogs();
      }
    } finally {
      setBusyXml(false);
    }
  };

  const handleValidarXml = async () => {
    if (!nota) return;
    setBusyValidar(true);
    setXmlValidationErrors([]);
    try {
      const r = await notasService.validarXml(nota.id);
      setXmlValidationErrors(r.errors);
      if (r.ok) {
        notify(r.message || 'XML conforme o leiaute 4.00.', 'success');
      } else {
        notify(r.message || 'Confrontação encontrou problemas no leiaute.', 'warning');
      }
    } catch (err: unknown) {
      setXmlValidationErrors(extractXmlErrors(err));
      reportError('Erro ao validar XML da NF-e.', err, 'Faturamento NF-e');
      void loadNotaLogs();
    } finally {
      setBusyValidar(false);
    }
  };

  const handleTransmitir = async () => {
    if (!nota) return;
    setBusyTx(true);
    setXmlValidationErrors([]);
    try {
      // Confrontação local automática antes da SEFAZ (padrão dos ERPs)
      const pre = await notasService.validarXml(nota.id);
      setXmlValidationErrors(pre.errors);
      if (!pre.ok) {
        notify('Confrontação do XML falhou — corrija antes de transmitir à SEFAZ.', 'warning');
        return;
      }
      const r = await notasService.transmitir(nota.id);
      notify(
        `${r.message} Protocolo: ${r.protocolo ?? '—'}. Próximo passo: Faturar no ERP (estoque/CR).`,
        'success',
      );
      await load();
      void loadNotaLogs();
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { error?: string; cStat?: string; code?: string } };
      };
      const d = ax.response?.data;
      setXmlValidationErrors(extractXmlErrors(err));
      if (d?.code === 'NFE_XML_INVALID') {
        notify(d.error || 'XML inválido — regenere e valide antes de transmitir.', 'warning');
      } else {
        reportError('Erro ao transmitir NF-e à SEFAZ.', err, 'Faturamento NF-e');
        void loadNotaLogs();
      }
      await load();
    } finally {
      setBusyTx(false);
    }
  };

  const handleDownloadXml = async () => {
    if (!nota?.chave_acesso) return;
    setXmlToolsBusy(true);
    try {
      const blob = await notasService.downloadXml(nota.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nota.chave_acesso}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      notify('Download do XML iniciado.', 'info');
    } catch (err: unknown) {
      reportError('Erro ao baixar XML da NF-e.', err, 'Faturamento NF-e');
      void loadNotaLogs();
    } finally {
      setXmlToolsBusy(false);
    }
  };

  const handleDanfePreview = async () => {
    if (!nota?.chave_acesso) return;
    setXmlToolsBusy(true);
    try {
      const blob = await notasService.danfePreviewBlob(nota.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch (err: unknown) {
      reportError('Erro ao abrir prévia DANFE.', err, 'Faturamento NF-e');
      void loadNotaLogs();
    } finally {
      setXmlToolsBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!nota) return;
    setSaving(true);
    try {
      await notasService.cancelar(nota.id, motivoCancel);
      setModal(null);
      notify('NF-e cancelada.', 'success');
      await load();
    } catch (err) {
      reportError('Erro ao cancelar NF-e.', err, 'Faturamento NF-e');
      void loadNotaLogs();
    } finally {
      setSaving(false);
    }
  };

  const setStep = (idx: number, status: FaturarStep['status']) =>
    setFaturarSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, status } : s)));

  const confirmarFaturamento = () => {
    setFaturarConfirmando(true);
    setFaturarError('');
    setFaturarSteps([
      { label: 'Confirmando autorização SEFAZ', status: 'pending' },
      { label: 'Baixando estoque dos itens', status: 'pending' },
      { label: `Gerando ${condicao.parcelas}x em Contas a Receber`, status: 'pending' },
      { label: 'Finalizando faturamento ERP', status: 'pending' },
    ]);
    void (async () => {
      if (!nota) return;
      setSaving(true);
      try {
        setStep(0, 'running');
        await new Promise((r) => setTimeout(r, 300));
        setStep(0, 'done');
        setStep(1, 'running');
        const res = await notasService.faturar(nota.id, condicao);
        setFaturarSteps((prev) =>
          prev.map((s, i) =>
            i === 1
              ? {
                  ...s,
                  status: 'done',
                  label:
                    res.itens_baixados > 0
                      ? `${res.itens_baixados} item(ns) com baixa de estoque`
                      : 'Sem produtos vinculados — estoque não alterado',
                }
              : s,
          ),
        );
        setStep(2, 'running');
        await new Promise((r) => setTimeout(r, 200));
        setFaturarSteps((prev) =>
          prev.map((s, i) =>
            i === 2
              ? {
                  ...s,
                  status: 'done',
                  label:
                    res.parcelas_criadas > 0
                      ? `${res.parcelas_criadas} parcela(s) em Contas a Receber`
                      : 'Sem destinatário — Contas a Receber não gerado',
                }
              : s,
          ),
        );
        setStep(3, 'running');
        await new Promise((r) => setTimeout(r, 200));
        setStep(3, 'done');
        setFaturarDone(true);
        notify('Faturamento ERP concluído (estoque e financeiro).', 'success');
        await load();
      } catch (err) {
        reportError('Erro ao faturar NF-e.', err, 'Faturamento NF-e');
        void loadNotaLogs();
        setFaturarSteps((prev) =>
          prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s)),
        );
        const ax = err as { response?: { data?: { error?: string } } };
        setFaturarError(ax.response?.data?.error || 'Erro ao faturar nota.');
      } finally {
        setSaving(false);
      }
    })();
  };

  const tabs: Tab[] = (() => {
    if (!nota) return [];

    const podeGerarXml =
      nota.status !== 'cancelada' && !nota.protocolo_autorizacao && nota.status !== 'emitida';
    const podeTransmitir =
      Boolean(nota.chave_acesso) &&
      !nota.protocolo_autorizacao &&
      nota.status !== 'cancelada' &&
      nota.status !== 'emitida';
    const podeFaturarErp =
      nota.status !== 'emitida' &&
      nota.status !== 'cancelada' &&
      Boolean(nota.protocolo_autorizacao);

    const detalhes = (
      <div className="space-y-6">
        <div className="bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded-xl px-4 py-3 text-xs text-brand-800 dark:text-brand-200 leading-relaxed">
          Fluxo alinhado aos ERPs (ex. Protheus):{' '}
          <strong>1. Gerar XML</strong> → <strong>2. Confrontar leiaute</strong> →{' '}
          <strong>3. Transmitir SEFAZ</strong> → só então{' '}
          <strong>4. Estoque + Contas a Receber</strong>. Parcelamento e baixa de estoque
          ocorrem após a autorização fiscal.
        </div>

        {nota.status === 'pendente_emissao' && !nota.protocolo_autorizacao && (
          <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700">
            XML e chave prontos. A confrontação roda automaticamente ao transmitir. Use{' '}
            <strong>Transmitir à SEFAZ</strong> (conexão <code className="font-mono">sefaz-dfe</code>
            ).
          </p>
        )}

        {nota.protocolo_autorizacao && (
          <div className="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-4 py-3 text-sm space-y-1">
            <p className="font-semibold text-sky-900 dark:text-sky-200">Autorização SEFAZ</p>
            <p className="font-mono text-xs text-sky-800 dark:text-sky-300">
              Protocolo: {nota.protocolo_autorizacao}
            </p>
            {nota.data_autorizacao && (
              <p className="text-xs text-sky-700 dark:text-sky-400">
                Recebido: {nota.data_autorizacao}
              </p>
            )}
            {nota.cstat_ultimo && (
              <p className="text-xs text-sky-700 dark:text-sky-400">
                cStat {nota.cstat_ultimo}
                {nota.xmotivo_ultimo ? ` — ${nota.xmotivo_ultimo}` : ''}
              </p>
            )}
            {nota.status !== 'emitida' && (
              <p className="text-xs text-sky-800 dark:text-sky-300 pt-1">
                Próximo passo: <strong>Faturar no ERP</strong> (estoque e parcelas).
              </p>
            )}
          </div>
        )}

        {nota.transmissao_erro && !nota.protocolo_autorizacao && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            Última tentativa SEFAZ: {nota.transmissao_erro}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Destinatário
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {nota.destinatario || '—'}
            </p>
            {nota.cpf_cnpj && <p className="text-xs text-slate-500 font-mono">{nota.cpf_cnpj}</p>}
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Operação
            </p>
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {nota.natureza_operacao || '—'}
            </p>
            <p className="text-xs text-slate-500">Criada: {fmtDate(nota.created_at)}</p>
          </div>
        </div>

        {nota.itens && nota.itens.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide px-4 pt-4 pb-2">
              Itens
            </p>
            <table className="w-full text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  {['Descrição', 'Qtd', 'Unid', 'CFOP', 'Vlr. Unit.', 'Total'].map((h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2 text-slate-500 dark:text-slate-400 font-semibold"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {nota.itens.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200 max-w-[200px] truncate">
                      {item.descricao}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{item.quantidade}</td>
                    <td className="px-3 py-2 text-slate-500">{item.unidade}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{item.cfop || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtBRL(item.valorUnitario)}</td>
                    <td className="px-3 py-2 font-bold tabular-nums">
                      {fmtBRL(item.valor_total ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex justify-end text-sm font-bold">
              Total NF-e:{' '}
              <span className="text-brand-600 dark:text-brand-400 ml-2">
                {fmtBRL(nota.valor_total)}
              </span>
            </div>
          </div>
        )}

        {nota.chave_acesso && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-xs space-y-2">
            <p className="font-semibold text-slate-600 dark:text-slate-300">Chave de acesso</p>
            <p className="font-mono text-[11px] break-all text-slate-800 dark:text-slate-100">
              {nota.chave_acesso}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleDownloadXml()}
                disabled={xmlToolsBusy}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Baixar XML
              </button>
              <button
                type="button"
                onClick={() => handleDanfePreview()}
                disabled={xmlToolsBusy}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Prévia DANFE
              </button>
            </div>
            {assinaturaVerifLoading && <p className="text-slate-500">Verificando assinatura…</p>}
            {!assinaturaVerifLoading && assinaturaVerif && (
              <div
                className={
                  assinaturaVerif.possuiAssinatura && assinaturaVerif.valida
                    ? 'rounded-md border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1.5 text-emerald-900 dark:text-emerald-200'
                    : 'rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/50 px-2 py-1.5 text-amber-900 dark:text-amber-200'
                }
              >
                <p className="font-medium">{assinaturaVerif.mensagem}</p>
              </div>
            )}
          </div>
        )}

        {xmlValidationErrors.length > 0 && (
          <div className="border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 rounded-xl px-3 py-3 space-y-2">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Confrontação leiaute NF-e — {xmlValidationErrors.length} item(ns)
            </p>
            <ul className="text-xs text-amber-900 dark:text-amber-100 space-y-1.5 max-h-48 overflow-y-auto list-none pl-0">
              {xmlValidationErrors.map((e, i) => (
                <li key={`${e.path}-${i}`} className="font-mono leading-snug">
                  <span className="text-amber-700 dark:text-amber-300">{e.path}</span>
                  <span className="text-slate-600 dark:text-slate-300"> — {e.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {nota.observacoes && (
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
            <span className="font-semibold">Obs: </span>
            {nota.observacoes}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigate('/faturamento/nf-venda')}
            className="px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Voltar
          </button>
          {podeGerarXml && (
            <button
              type="button"
              onClick={() => handlePrepararXml(Boolean(nota.chave_acesso))}
              disabled={busyXml}
              className="px-4 py-2.5 text-sm bg-slate-700 hover:bg-slate-800 text-white font-medium rounded-xl disabled:opacity-50"
            >
              {busyXml ? 'Gerando…' : nota.chave_acesso ? 'Regerar XML' : 'Gerar XML NF-e'}
            </button>
          )}
          {nota.chave_acesso && (
            <button
              type="button"
              onClick={() => handleValidarXml()}
              disabled={busyValidar}
              className="px-4 py-2.5 text-sm border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 font-medium rounded-xl disabled:opacity-50"
            >
              {busyValidar ? 'Validando…' : 'Validar XML'}
            </button>
          )}
          {podeTransmitir && (
            <button
              type="button"
              onClick={() => handleTransmitir()}
              disabled={busyTx}
              className="px-4 py-2.5 text-sm bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {busyTx ? 'Transmitindo…' : 'Transmitir à SEFAZ'}
            </button>
          )}
          {podeFaturarErp && (
            <button
              type="button"
              onClick={() => {
                setFaturarDone(false);
                setFaturarConfirmando(false);
                setFaturarError('');
                setCondicao({
                  parcelas: 1,
                  vencimento: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
                  intervalo_dias: 30,
                });
                setModal('faturar');
              }}
              className="px-4 py-2.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
            >
              Faturar no ERP
            </button>
          )}
          {nota.status !== 'cancelada' && nota.status !== 'emitida' && (
            <button
              type="button"
              onClick={() => {
                setMotivoCancel('');
                setModal('cancel');
              }}
              className="px-4 py-2.5 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    );

    const logsContent = (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Erros registrados nesta tela da nota ({logsTotal}).
          </p>
          <button
            type="button"
            onClick={() => void loadNotaLogs()}
            disabled={logsLoading}
            className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
          >
            {logsLoading ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>

        {nota.transmissao_erro && (
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
              Último retorno SEFAZ (na nota)
            </p>
            <p className="mt-1 text-amber-900 dark:text-amber-100">{nota.transmissao_erro}</p>
            {nota.cstat_ultimo && (
              <p className="mt-1 text-xs font-mono text-amber-800 dark:text-amber-300">
                cStat {nota.cstat_ultimo}
                {nota.xmotivo_ultimo ? ` — ${nota.xmotivo_ultimo}` : ''}
              </p>
            )}
          </div>
        )}

        {logsLoading && notaLogs.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center">Carregando logs…</p>
        ) : notaLogs.length === 0 ? (
          <p className="text-sm text-slate-500 py-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            Nenhum erro de sistema vinculado a esta nota.
          </p>
        ) : (
          <ul className="space-y-2">
            {notaLogs.map((log) => (
              <li key={log.id}>
                <Link
                  to={`/configuracoes/logs/${log.id}`}
                  className="block rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 hover:border-brand-300 dark:hover:border-brand-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      {log.friendly_message}
                    </p>
                    <time className="text-[11px] text-slate-500 whitespace-nowrap">
                      {fmtLogWhen(log.timestamp || log.created_at)}
                    </time>
                  </div>
                  {log.context && (
                    <p className="text-xs text-slate-500 mt-1">{log.context}</p>
                  )}
                  {log.technical && (
                    <pre className="mt-2 text-[11px] font-mono text-slate-600 dark:text-slate-400 whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {log.technical}
                    </pre>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );

    return [
      { id: 'detalhes', label: 'Detalhes', content: detalhes },
      {
        id: 'logs',
        label: 'Logs',
        count: logsTotal > 0 ? logsTotal : undefined,
        content: logsContent,
      },
    ];
  })();

  // Carrega logs ao montar / trocar nota (aba Logs usa a lista já carregada)
  useEffect(() => {
    if (nota?.id) void loadNotaLogs();
  }, [nota?.id, loadNotaLogs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="animate-spin w-8 h-8 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      </div>
    );
  }

  if (!nota) {
    return (
      <div className="space-y-4">
        <Link to="/faturamento/nf-venda" className="text-sm text-brand-600 hover:underline">
          ← Voltar à lista
        </Link>
        <p className="text-red-600 dark:text-red-400">Nota não encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/faturamento/nf-venda"
            className="text-xs font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
          >
            ← NF-e Venda
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display mt-1">
            NF-e{' '}
            {nota.numero
              ? `${String(nota.numero).padStart(6, '0')}/${nota.serie ?? '1'}`
              : '(Rascunho)'}
          </h1>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold mt-2 ${STATUS_STYLE[nota.status] ?? STATUS_STYLE.rascunho}`}
          >
            {STATUS_LABEL[nota.status] ?? nota.status}
          </span>
          {nota.ambiente === 2 && (
            <span className="ml-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
              Homologação SEFAZ
            </span>
          )}
        </div>
      </div>

      <Tabs tabs={tabs} defaultTab="detalhes" />

      {modal === 'faturar' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-md space-y-5">
            {!faturarConfirmando && (
              <>
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Condição de pagamento (ERP)
                </h2>
                <p className="text-xs text-slate-500">
                  Após autorização SEFAZ: gera parcelas no Contas a Receber e baixa estoque.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Parcelas</label>
                    <select
                      value={condicao.parcelas}
                      onChange={(e) => setCondicao((c) => ({ ...c, parcelas: Number(e.target.value) }))}
                      className="w-full border rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <option key={n} value={n}>
                          {n}x
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">1º Venc.</label>
                    <input
                      type="date"
                      value={condicao.vencimento}
                      onChange={(e) => setCondicao((c) => ({ ...c, vencimento: e.target.value }))}
                      className="w-full border rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Intervalo</label>
                    <select
                      value={condicao.intervalo_dias}
                      onChange={(e) =>
                        setCondicao((c) => ({ ...c, intervalo_dias: Number(e.target.value) }))
                      }
                      className="w-full border rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
                    >
                      <option value={7}>7 dias</option>
                      <option value={14}>14 dias</option>
                      <option value={30}>30 dias</option>
                      <option value={60}>60 dias</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="flex-1 px-4 py-2.5 text-sm border rounded-xl"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={confirmarFaturamento}
                    className="flex-1 px-4 py-2.5 text-sm bg-emerald-600 text-white font-semibold rounded-xl"
                  >
                    Confirmar
                  </button>
                </div>
              </>
            )}
            {faturarConfirmando && (
              <>
                <h2 className="text-base font-bold text-center">
                  {faturarDone ? 'Faturamento ERP concluído!' : 'Processando…'}
                </h2>
                <div className="space-y-3">
                  {faturarSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <span
                        className={
                          step.status === 'done'
                            ? 'text-emerald-600'
                            : step.status === 'error'
                              ? 'text-red-600'
                              : step.status === 'running'
                                ? 'text-brand-600'
                                : 'text-slate-400'
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
                {faturarError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{faturarError}</p>
                )}
                {(faturarDone || faturarError) && (
                  <button
                    type="button"
                    onClick={() => {
                      setModal(null);
                      setFaturarError('');
                    }}
                    disabled={saving}
                    className="w-full px-4 py-2.5 text-sm bg-brand-600 text-white font-semibold rounded-xl"
                  >
                    Fechar
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {modal === 'cancel' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold">Cancelar NF-e</h2>
            <textarea
              value={motivoCancel}
              onChange={(e) => setMotivoCancel(e.target.value)}
              rows={3}
              placeholder="Motivo…"
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-600"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="flex-1 border rounded-lg py-2 text-sm"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
