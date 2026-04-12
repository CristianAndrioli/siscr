import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface EmpresaRow {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  crt?: string | null;
  cnae?: string | null;
  nfe_serie?: string | null;
  nfe_ambiente?: number | null;
  nfe_proximo_numero?: number | null;
}

function normalizeEmpresa(row: unknown): EmpresaRow {
  const r = row as Record<string, unknown>;
  return {
    id: String(r.id ?? ''),
    razao_social: String(r.razao_social ?? r.razaoSocial ?? ''),
    nome_fantasia: (r.nome_fantasia ?? r.nomeFantasia) as string | null | undefined,
    cnpj: (r.cnpj as string) ?? null,
    crt: r.crt != null ? String(r.crt) : null,
    cnae: r.cnae != null ? String(r.cnae) : null,
    nfe_serie: r.nfe_serie != null ? String(r.nfe_serie) : r.nfeSerie != null ? String(r.nfeSerie) : null,
    nfe_ambiente:
      typeof r.nfe_ambiente === 'number'
        ? r.nfe_ambiente
        : typeof r.nfeAmbiente === 'number'
          ? r.nfeAmbiente
          : null,
    nfe_proximo_numero:
      typeof r.nfe_proximo_numero === 'number'
        ? r.nfe_proximo_numero
        : typeof r.nfeProximoNumero === 'number'
          ? r.nfeProximoNumero
          : null,
  };
}

const FIELD =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

export function FaturamentoConfigPage() {
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [crt, setCrt] = useState<'1' | '2' | '3'>('1');
  const [cnae, setCnae] = useState('');
  const [nfeSerie, setNfeSerie] = useState('1');
  const [nfeAmbiente, setNfeAmbiente] = useState<1 | 2>(2);
  const [nfeProximoNumero, setNfeProximoNumero] = useState('1');

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

  useEffect(() => {
    if (!selected) return;
    setCrt((selected.crt === '2' || selected.crt === '3' ? selected.crt : '1') as '1' | '2' | '3');
    setCnae(selected.cnae?.trim() ?? '');
    setNfeSerie(selected.nfe_serie?.trim() || '1');
    setNfeAmbiente(selected.nfe_ambiente === 1 ? 1 : 2);
    const n = selected.nfe_proximo_numero;
    setNfeProximoNumero(n != null && n >= 1 ? String(n) : '1');
  }, [selected]);

  const save = async () => {
    if (!empresaId || !selected) {
      setError('Selecione uma empresa.');
      return;
    }
    const serie = nfeSerie.trim();
    const prox = parseInt(nfeProximoNumero.replace(/\D/g, ''), 10);
    if (!serie || serie.length > 3) {
      setError('Informe a série da NF-e (até 3 caracteres).');
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
        crt,
        cnae: cnae.trim() || undefined,
        nfeSerie: serie,
        nfeAmbiente,
        nfeProximoNumero: prox,
      });
      setOkMsg('Configurações de faturamento salvas.');
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Faturamento (NF-e)</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Ambiente SEFAZ, numeração e perfil fiscal usados na emissão de NF-e por empresa.
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
              <select
                value={empresaId}
                onChange={(e) => setEmpresaId(e.target.value)}
                className={FIELD}
              >
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.razao_social}
                    {e.nome_fantasia ? ` — ${e.nome_fantasia}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                nfeAmbiente === 2
                  ? 'border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/25 text-amber-950 dark:text-amber-100'
                  : 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/80 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-100'
              }`}
            >
              <p className="font-semibold">
                {nfeAmbiente === 2 ? 'Ambiente de homologação (testes)' : 'Ambiente de produção'}
              </p>
              <p className="mt-1 text-xs opacity-90 leading-relaxed">
                {nfeAmbiente === 2
                  ? 'Notas transmitidas para homologação não têm validade fiscal. Use para validar integração antes de ir à produção.'
                  : 'Notas transmitidas em produção são documentos fiscais válidos. Confira série, numeração e dados cadastrais antes de emitir.'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Ambiente SEFAZ (NF-e)
              </label>
              <select
                value={nfeAmbiente}
                onChange={(e) => setNfeAmbiente(Number(e.target.value) as 1 | 2)}
                className={FIELD}
              >
                <option value={2}>2 — Homologação</option>
                <option value={1}>1 — Produção</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Série</label>
                <input
                  value={nfeSerie}
                  onChange={(e) => setNfeSerie(e.target.value)}
                  maxLength={3}
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
                  value={nfeProximoNumero}
                  onChange={(e) => setNfeProximoNumero(e.target.value.replace(/\D/g, ''))}
                  className={`${FIELD} font-mono`}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Ajuste com cuidado em produção para não duplicar ou pular numeração indevida.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                CRT (código de regime tributário)
              </label>
              <select value={crt} onChange={(e) => setCrt(e.target.value as '1' | '2' | '3')} className={FIELD}>
                <option value="1">1 — Simples Nacional</option>
                <option value="2">2 — Simples Nacional (excesso de sublimite)</option>
                <option value="3">3 — Regime normal (Lucro Presumido / Real)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                CNAE fiscal (opcional)
              </label>
              <input
                value={cnae}
                onChange={(e) => setCnae(e.target.value)}
                maxLength={10}
                className={`${FIELD} font-mono`}
                placeholder="Principal da empresa"
              />
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
              Dados cadastrais da empresa
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
