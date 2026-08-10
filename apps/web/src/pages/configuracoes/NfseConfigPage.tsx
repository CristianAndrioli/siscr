import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface EmpresaRow {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  codigo_municipio?: string | null;
  inscricao_municipal?: string | null;
  nfse_serie?: string | null;
  nfse_ambiente?: number | null;
  nfse_proximo_numero?: number | null;
  nfse_codigo_servico_padrao?: string | null;
  a1_cert_uploaded_at?: string | null;
}

function normalizeEmpresa(row: unknown): EmpresaRow {
  const r = row as Record<string, unknown>;
  const num = (a: unknown, b: unknown) =>
    typeof a === 'number' ? a : typeof b === 'number' ? b : null;
  return {
    id: String(r.id ?? ''),
    razao_social: String(r.razao_social ?? r.razaoSocial ?? ''),
    nome_fantasia: (r.nome_fantasia ?? r.nomeFantasia) as string | null | undefined,
    cnpj: (r.cnpj as string) ?? null,
    codigo_municipio:
      r.codigo_municipio != null
        ? String(r.codigo_municipio)
        : r.codigoMunicipio != null
          ? String(r.codigoMunicipio)
          : null,
    inscricao_municipal:
      r.inscricao_municipal != null
        ? String(r.inscricao_municipal)
        : r.inscricaoMunicipal != null
          ? String(r.inscricaoMunicipal)
          : null,
    nfse_serie:
      r.nfse_serie != null ? String(r.nfse_serie) : r.nfseSerie != null ? String(r.nfseSerie) : null,
    nfse_ambiente: num(r.nfse_ambiente, r.nfseAmbiente),
    nfse_proximo_numero: num(r.nfse_proximo_numero, r.nfseProximoNumero),
    nfse_codigo_servico_padrao:
      r.nfse_codigo_servico_padrao != null
        ? String(r.nfse_codigo_servico_padrao)
        : r.nfseCodigoServicoPadrao != null
          ? String(r.nfseCodigoServicoPadrao)
          : null,
    a1_cert_uploaded_at: (r.a1_cert_uploaded_at ?? r.a1CertUploadedAt) as string | null | undefined,
  };
}

function adapterFromCmun(cMun: string | null | undefined): {
  kind: 'paulistana' | 'nacional' | 'unsupported';
  label: string;
} {
  const c = String(cMun ?? '').replace(/\D/g, '');
  if (c === '3550308') return { kind: 'paulistana', label: 'Nota Fiscal Paulistana (São Paulo capital)' };
  if (c === '4204202') return { kind: 'nacional', label: 'Sistema Nacional NFS-e (Chapecó)' };
  return { kind: 'unsupported', label: 'Município não suportado nesta versão' };
}

const FIELD =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

export function NfseConfigPage() {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [im, setIm] = useState('');
  const [nfseSerie, setNfseSerie] = useState('1');
  const [nfseAmbiente, setNfseAmbiente] = useState<1 | 2>(2);
  const [nfseProximoNumero, setNfseProximoNumero] = useState('1');
  const [codigoServico, setCodigoServico] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<{ empresas: unknown[] }>('/tenant/info/empresas');
      const list = (data.empresas ?? []).map(normalizeEmpresa);
      setEmpresas(list);
      setEmpresaId((prev) => {
        if (list.length === 0) return '';
        if (prev && list.some((e) => e.id === prev)) return prev;
        return list[0].id;
      });
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Não foi possível carregar as empresas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => empresas.find((e) => e.id === empresaId), [empresas, empresaId]);
  const adapter = adapterFromCmun(selected?.codigo_municipio);

  useEffect(() => {
    if (!selected) return;
    setIm(selected.inscricao_municipal?.trim() ?? '');
    setNfseSerie(selected.nfse_serie?.trim() || '1');
    setNfseAmbiente(selected.nfse_ambiente === 1 ? 1 : 2);
    const n = selected.nfse_proximo_numero;
    setNfseProximoNumero(n != null && n >= 1 ? String(n) : '1');
    setCodigoServico(selected.nfse_codigo_servico_padrao?.trim() ?? '');
  }, [selected]);

  const checklist = useMemo(() => {
    const a1Ok = Boolean(selected?.a1_cert_uploaded_at);
    const imOk = im.trim().length > 0;
    const munOk = adapter.kind !== 'unsupported';
    const serieOk = nfseSerie.trim().length > 0;
    return [
      { ok: munOk, label: munOk ? `Município: ${adapter.label}` : 'Município IBGE não suportado (SP 3550308 ou Chapecó 4204202)' },
      { ok: imOk, label: imOk ? 'Inscrição municipal informada' : 'Informe a inscrição municipal (IM)' },
      { ok: a1Ok, label: a1Ok ? 'Certificado A1 enviado' : 'Envie o certificado A1 em Empresas e Filiais' },
      { ok: serieOk, label: serieOk ? 'Série / numeração definidas' : 'Defina a série da NFS-e' },
    ];
  }, [selected, im, adapter, nfseSerie]);

  const save = async () => {
    if (!empresaId || !selected) {
      setError('Selecione uma empresa.');
      return;
    }
    const serie = nfseSerie.trim();
    const prox = parseInt(nfseProximoNumero.replace(/\D/g, ''), 10);
    if (!serie || serie.length > 5) {
      setError('Informe a série da NFS-e (até 5 caracteres).');
      return;
    }
    if (!Number.isFinite(prox) || prox < 1) {
      setError('O próximo número deve ser um inteiro maior ou igual a 1.');
      return;
    }
    setSaving(true);
    setError('');
    setOkMsg('');
    try {
      await api.put(`/tenant/info/empresas/${empresaId}`, {
        inscricaoMunicipal: im.trim() || null,
        nfseSerie: serie,
        nfseAmbiente,
        nfseProximoNumero: prox,
        nfseCodigoServicoPadrao: codigoServico.trim() || null,
      });
      setOkMsg('Configurações de NFS-e salvas.');
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/configuracoes"
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium mb-2 inline-block"
          >
            ← Configurações
          </Link>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Faturamento (NFS-e)</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Ambiente, numeração e inscrição municipal para emissão de notas de serviço.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Carregando…</p>
      ) : empresas.length === 0 ? (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          Nenhuma empresa cadastrada. Cadastre uma empresa em{' '}
          <Link to="/configuracoes/filiais" className="font-medium underline">
            Empresas e Filiais
          </Link>
          .
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Empresa</label>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} className={FIELD}>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.razao_social}
                    {e.nome_fantasia ? ` — ${e.nome_fantasia}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-sm">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Adaptador municipal</p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                IBGE {selected?.codigo_municipio || '—'} — {adapter.label}. O código do município vem do cadastro da
                empresa (ou filial). Fluxo: Gerar → Transmitir prefeitura → Faturar ERP.
              </p>
            </div>

            <div
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                nfseAmbiente === 2
                  ? 'border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/25 text-amber-950 dark:text-amber-100'
                  : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100'
              }`}
            >
              <p className="font-semibold">
                {nfseAmbiente === 2 ? 'Ambiente de homologação (testes)' : 'Ambiente de produção'}
              </p>
              <p className="mt-1 text-xs opacity-90 leading-relaxed">
                {adapter.kind === 'paulistana' && nfseAmbiente === 2
                  ? 'Paulistana usa o mesmo endpoint de produção com TesteEnvioLoteRPS (sem NFS-e fiscal real).'
                  : nfseAmbiente === 2
                    ? 'Notas em homologação do Sistema Nacional não têm validade fiscal.'
                    : 'Notas em produção são documentos fiscais válidos.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Ambiente NFS-e
              </label>
              <select
                value={nfseAmbiente}
                onChange={(e) => setNfseAmbiente(Number(e.target.value) as 1 | 2)}
                className={FIELD}
              >
                <option value={2}>2 — Homologação</option>
                <option value={1}>1 — Produção</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Inscrição municipal (IM)
              </label>
              <input
                value={im}
                onChange={(e) => setIm(e.target.value)}
                className={`${FIELD} font-mono`}
                placeholder="Número da IM na prefeitura"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Série (RPS / DPS)
                </label>
                <input
                  value={nfseSerie}
                  onChange={(e) => setNfseSerie(e.target.value)}
                  maxLength={5}
                  className={`${FIELD} font-mono`}
                  placeholder="1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Próximo número
                </label>
                <input
                  inputMode="numeric"
                  value={nfseProximoNumero}
                  onChange={(e) => setNfseProximoNumero(e.target.value.replace(/\D/g, ''))}
                  className={`${FIELD} font-mono`}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Código de serviço municipal padrão (Paulistana)
              </label>
              <input
                value={codigoServico}
                onChange={(e) => setCodigoServico(e.target.value)}
                className={`${FIELD} font-mono`}
                placeholder="Ex: 02800"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Em São Paulo use o código da lista da Prefeitura (4–5 dígitos), não o item da LC 116
                (01.01). Consulte o CCM / portal da Nota Fiscal Paulistana.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-3 space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Checklist de prontidão</p>
              <ul className="space-y-1.5">
                {checklist.map((item) => (
                  <li key={item.label} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span className={item.ok ? 'text-emerald-600' : 'text-amber-600'}>{item.ok ? '✓' : '!'}</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}
          {okMsg && (
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
              {okMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar configurações'}
            </button>
            <Link
              to="/configuracoes/filiais"
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Empresas e Filiais
            </Link>
            <Link
              to="/faturamento/nfse"
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Ir para NFS-e
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
