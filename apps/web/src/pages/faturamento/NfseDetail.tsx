import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { notasService, type NotaFiscal, type NFStatus } from '../../services/faturamentoService';
import { fmtBRL, fmtDate } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import Tabs, { type Tab } from '../../components/common/Tabs';
import { fetchErrorLog, type ErrorLogEntry } from '../../utils/errorLogger';

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
  pendente_emissao: 'XML/DPS gerado',
  autorizada: 'Autorizada (prefeitura)',
  emitida: 'Faturada (ERP)',
  cancelada: 'Cancelada',
  inutilizada: 'Inutilizada',
};

const fmtPct = (v?: number | null) => (v != null ? `${v}%` : '—');

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

export default function NfseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { reportError, notify } = useErrorNotification();

  const [nota, setNota] = useState<NotaFiscal | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPrep, setBusyPrep] = useState(false);
  const [busyTx, setBusyTx] = useState(false);

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
      reportError('Erro ao carregar NFS-e.', err, 'Faturamento NFS-e');
    } finally {
      setLoading(false);
    }
  }, [id, reportError]);

  const loadNotaLogs = useCallback(async () => {
    if (!id) return;
    setLogsLoading(true);
    try {
      const page = await fetchErrorLog({
        page: 0,
        limit: 50,
        urlContains: `/faturamento/nfse/${id}`,
      });
      setNotaLogs(page.errors);
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
    if (nota?.id) void loadNotaLogs();
  }, [nota?.id, loadNotaLogs]);

  const handlePreparar = async (force = false) => {
    if (!nota) return;
    setBusyPrep(true);
    try {
      const r = await notasService.prepararNfse(nota.id, { force });
      notify(
        `${r.message}${r.signed ? ' Assinatura digital aplicada.' : ''} Adapter: ${r.adapter}.`,
        'success',
      );
      await load();
      void loadNotaLogs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg) notify(msg, 'warning');
      else {
        reportError('Erro ao gerar XML/DPS da NFS-e.', err, 'Faturamento NFS-e');
        void loadNotaLogs();
      }
    } finally {
      setBusyPrep(false);
    }
  };

  const handleTransmitir = async () => {
    if (!nota) return;
    setBusyTx(true);
    try {
      if (nota.status === 'rascunho') {
        const prep = await notasService.prepararNfse(nota.id, { force: false });
        notify(prep.message, 'info');
      }
      const r = await notasService.transmitirNfse(nota.id);
      notify(
        `${r.message} Protocolo: ${r.protocolo ?? '—'}. Próximo passo: Faturar no ERP.`,
        'success',
      );
      await load();
      void loadNotaLogs();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg) notify(msg, 'warning');
      else {
        reportError('Erro ao transmitir NFS-e à prefeitura.', err, 'Faturamento NFS-e');
        void loadNotaLogs();
      }
      await load();
    } finally {
      setBusyTx(false);
    }
  };

  const handleCancel = async () => {
    if (!nota) return;
    setSaving(true);
    try {
      await notasService.cancelar(nota.id, motivoCancel);
      setModal(null);
      notify('NFS-e cancelada.', 'success');
      await load();
    } catch (err) {
      reportError('Erro ao cancelar NFS-e.', err, 'Faturamento NFS-e');
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
      { label: 'Confirmando autorização municipal', status: 'pending' },
      { label: 'Faturando no ERP', status: 'pending' },
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
        setStep(1, 'done');
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
        notify('Faturamento ERP concluído (financeiro).', 'success');
        await load();
      } catch (err: unknown) {
        setFaturarSteps((prev) =>
          prev.map((s) => (s.status === 'running' ? { ...s, status: 'error' } : s)),
        );
        const msg =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Erro ao faturar NFS-e.';
        setFaturarError(msg);
        reportError('Erro ao faturar NFS-e.', err, 'Faturamento NFS-e');
        void loadNotaLogs();
      } finally {
        setSaving(false);
      }
    })();
  };

  const podeGerar =
    nota &&
    nota.status !== 'emitida' &&
    nota.status !== 'cancelada' &&
    !nota.protocolo_autorizacao;
  const podeTransmitir =
    nota &&
    !nota.protocolo_autorizacao &&
    (nota.status === 'rascunho' || nota.status === 'pendente_emissao');
  const podeFaturarErp =
    nota &&
    nota.status !== 'emitida' &&
    nota.status !== 'cancelada' &&
    Boolean(nota.protocolo_autorizacao || nota.status === 'autorizada');

  const tabs: Tab[] = (() => {
    if (!nota) return [];

    const detalhes = (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Tomador
            </p>
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {nota.destinatario || '—'}
            </p>
            {nota.cpf_cnpj && (
              <p className="text-xs text-slate-500 font-mono">{nota.cpf_cnpj}</p>
            )}
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Emissão / serviço
            </p>
            <p className="font-medium text-slate-700 dark:text-slate-200">
              {fmtDate(nota.data_emissao || nota.created_at)}
            </p>
            {nota.codigo_servico && (
              <p className="text-xs text-slate-500">LC 116: {nota.codigo_servico}</p>
            )}
            {nota.serie && (
              <p className="text-xs text-slate-500">Série RPS/DPS: {nota.serie}</p>
            )}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Serviço
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {nota.descricao_servico || '—'}
          </p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2 text-sm">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Valores
          </p>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Valor do serviço:</span>
            <span className="tabular-nums">
              {fmtBRL(nota.valor_produtos ?? nota.valor_total)}
            </span>
          </div>
          {nota.aliquota_iss != null && (
            <div className="flex justify-between text-amber-600 dark:text-amber-400">
              <span>ISS ({fmtPct(nota.aliquota_iss)}):</span>
              <span className="tabular-nums">{fmtBRL(nota.valor_iss ?? 0)}</span>
            </div>
          )}
          {(nota.valor_desconto ?? 0) > 0 && (
            <div className="flex justify-between text-slate-500">
              <span>Desconto:</span>
              <span>-{fmtBRL(nota.valor_desconto ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-2">
            <span>Total:</span>
            <span className="text-brand-600 dark:text-brand-400 text-base tabular-nums">
              {fmtBRL(nota.valor_total)}
            </span>
          </div>
        </div>

        {(nota.protocolo_autorizacao || nota.chave_acesso || nota.cstat_ultimo) && (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1 text-sm">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              Autorização municipal
            </p>
            {nota.protocolo_autorizacao && (
              <p className="text-slate-700 dark:text-slate-200">
                Protocolo/nº:{' '}
                <span className="font-mono">{nota.protocolo_autorizacao}</span>
              </p>
            )}
            {nota.chave_acesso && (
              <p className="text-slate-700 dark:text-slate-200 text-xs break-all">
                Chave: <span className="font-mono">{nota.chave_acesso}</span>
              </p>
            )}
            {nota.data_autorizacao && (
              <p className="text-xs text-slate-500">
                Autorizada em {fmtDate(nota.data_autorizacao)}
              </p>
            )}
            {nota.cstat_ultimo && (
              <p className="text-xs text-slate-500">
                {nota.cstat_ultimo}
                {nota.xmotivo_ultimo ? `: ${nota.xmotivo_ultimo}` : ''}
              </p>
            )}
          </div>
        )}

        {nota.observacoes && (
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2">
            <span className="font-semibold">Obs: </span>
            {nota.observacoes}
          </p>
        )}

        {nota.motivo_cancelamento && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            <span className="font-semibold">Cancelamento: </span>
            {nota.motivo_cancelamento}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigate('/faturamento/nfse')}
            className="px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Voltar
          </button>
          {podeGerar && (
            <button
              type="button"
              onClick={() => handlePreparar(nota.status === 'pendente_emissao')}
              disabled={busyPrep || busyTx}
              className="px-4 py-2.5 text-sm bg-slate-700 hover:bg-slate-800 text-white font-medium rounded-xl disabled:opacity-50"
            >
              {busyPrep
                ? 'Gerando…'
                : nota.status === 'pendente_emissao'
                  ? 'Regerar XML/DPS'
                  : 'Gerar XML/DPS'}
            </button>
          )}
          {podeTransmitir && (
            <button
              type="button"
              onClick={() => void handleTransmitir()}
              disabled={busyTx || busyPrep}
              className="px-4 py-2.5 text-sm bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {busyTx ? 'Transmitindo…' : 'Transmitir prefeitura'}
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
          <Link
            to="/configuracoes/nfse"
            className="px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Configurar emissão
          </Link>
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
              Último retorno da prefeitura (na nota)
            </p>
            <p className="mt-1 text-amber-900 dark:text-amber-100">{nota.transmissao_erro}</p>
            {nota.cstat_ultimo && (
              <p className="mt-1 text-xs font-mono text-amber-800 dark:text-amber-300">
                {nota.cstat_ultimo}
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
        <Link to="/faturamento/nfse" className="text-sm text-brand-600 hover:underline">
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
            to="/faturamento/nfse"
            className="text-xs font-medium text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400"
          >
            ← NFS-e
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display mt-1">
            NFS-e{' '}
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
              Homologação
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
                  Após autorização da prefeitura: gera parcelas no Contas a Receber.
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
            <h2 className="text-lg font-bold">Cancelar NFS-e</h2>
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
                onClick={() => void handleCancel()}
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
