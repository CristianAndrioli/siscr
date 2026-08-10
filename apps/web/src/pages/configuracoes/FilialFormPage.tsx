import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import MaskedInput from '../../components/common/MaskedInput';
import api from '../../services/api';
import { authService } from '../../services/auth';
import { fetchCepComIbge } from '../../services/brasilCepIbge';
import { formatApiError } from '../../utils/helpers';
import {
  CertMetaDetails,
  Field,
  MaskedField,
  SelectField,
  UF_LIST,
  emptyFilial,
  filialToForm,
  fmtDate,
  normalizeFilialRow,
  parseA1CertMeta,
  type Filial,
  type FilialForm,
  FIELD_CLS,
} from './filiaisFormShared';

export default function FilialFormPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'novo';
  const empresaIdParam = searchParams.get('empresaId');
  const isAdmin = (authService.getLocalUser() as { role?: string } | null)?.role === 'admin';

  const [form, setForm] = useState<FilialForm>(emptyFilial());
  const [filial, setFilial] = useState<Filial | null>(null);
  const [empresaId, setEmpresaId] = useState<string | null>(empresaIdParam);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [loadingCep, setLoadingCep] = useState(false);
  const [certStorageReady, setCertStorageReady] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPwd, setCertPwd] = useState('');
  const [certBusy, setCertBusy] = useState(false);
  const [certSyncBusy, setCertSyncBusy] = useState(false);

  const setFF = (k: keyof FilialForm, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    if (isNew) {
      if (!empresaIdParam) {
        setFormError('Empresa não informada. Volte à lista e escolha Nova Filial.');
      }
      setEmpresaId(empresaIdParam);
      setLoading(false);
      return;
    }
    if (!id) return;
    setLoading(true);
    setFormError('');
    try {
      const fRes = await api.get('/tenant/info/filiais');
      const list = (fRes.data.filiais ?? []).map(normalizeFilialRow);
      const found = list.find((x: Filial) => x.id === id);
      if (!found) {
        setFormError('Filial não encontrada.');
        return;
      }
      setFilial(found);
      setEmpresaId(found.empresa_id);
      setForm(filialToForm(found));
    } catch {
      setFormError('Erro ao carregar filial.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew, empresaIdParam]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api
      .get('/tenant/info/onboarding')
      .then((r) => setCertStorageReady(!!r.data.certificateStorageReady))
      .catch(() => setCertStorageReady(false));
  }, []);

  const cepRef = useRef('');
  useEffect(() => {
    const digits = form.cep.replace(/\D/g, '');
    if (digits.length === 8 && digits !== cepRef.current) {
      cepRef.current = digits;
      setLoadingCep(true);
      fetchCepComIbge(digits)
        .then((data) => {
          if (data) {
            setForm((f) => ({
              ...f,
              logradouro: data.logradouro || f.logradouro,
              bairro: data.bairro || f.bairro,
              cidade: data.cidade || f.cidade,
              uf: data.uf || f.uf,
              codigoMunicipio: data.codigoMunicipioIbge || f.codigoMunicipio,
            }));
          }
        })
        .finally(() => setLoadingCep(false));
    }
    if (digits.length < 8) cepRef.current = '';
  }, [form.cep]);

  const handleSave = async () => {
    if (!form.nome.trim()) {
      setFormError('Nome da filial é obrigatório.');
      return;
    }
    if (isNew && !empresaId) {
      setFormError('Empresa não informada.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...form, ativa: form.ativa };
      if (!isNew && id) {
        await api.put(`/tenant/info/filiais/${id}`, payload);
        await load();
      } else {
        await api.post(`/tenant/info/empresas/${empresaId}/filiais`, payload);
        navigate('/configuracoes/filiais');
      }
    } catch (err: unknown) {
      setFormError(formatApiError(err, 'Erro ao salvar filial.'));
    } finally {
      setSaving(false);
    }
  };

  const uploadCert = async () => {
    if (!id || isNew || !certFile || !certPwd.trim()) {
      setFormError('Selecione o arquivo .pfx ou .p12 e informe a senha.');
      return;
    }
    setCertBusy(true);
    setFormError('');
    try {
      const fd = new FormData();
      fd.append('file', certFile);
      fd.append('password', certPwd);
      await api.post(`/tenant/info/filiais/${id}/certificado-a1`, fd);
      setCertFile(null);
      setCertPwd('');
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFormError(ax.response?.data?.error || 'Erro ao enviar certificado.');
    } finally {
      setCertBusy(false);
    }
  };

  const syncCertMeta = async () => {
    if (!id || isNew) return;
    setCertSyncBusy(true);
    setFormError('');
    try {
      await api.post(`/tenant/info/filiais/${id}/certificado-a1/atualizar-metadados`);
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFormError(ax.response?.data?.error || 'Erro ao atualizar dados do certificado.');
    } finally {
      setCertSyncBusy(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Carregando filial..." />;
  }

  const uploadedAt = filial?.a1_cert_uploaded_at;
  const meta = parseA1CertMeta(filial?.a1_cert_meta);

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to="/configuracoes/filiais"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar a empresas e filiais
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          {isNew ? 'Nova Filial' : 'Editar Filial'}
        </h1>
      </div>

      {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Nome da Filial" value={form.nome} onChange={(v) => setFF('nome', v)} required />
          </div>
          <MaskedField
            label="CNPJ"
            mask="cnpj"
            value={form.cnpj}
            onChange={(v) => setFF('cnpj', v)}
            placeholder="00.000.000/0000-00"
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">CEP</label>
            <div className="relative">
              <MaskedInput
                mask="cep"
                value={form.cep}
                onChange={(v) => setFF('cep', v)}
                placeholder="00000-000"
                className={FIELD_CLS}
              />
              {loadingCep && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>
          </div>
          <Field label="Cidade" value={form.cidade} onChange={(v) => setFF('cidade', v)} />
          <SelectField label="UF" value={form.uf} onChange={(v) => setFF('uf', v)} options={UF_LIST} />
          <div className="col-span-2">
            <Field label="Logradouro" value={form.logradouro} onChange={(v) => setFF('logradouro', v)} />
          </div>
          <Field label="Número" value={form.numero} onChange={(v) => setFF('numero', v)} />
          <Field label="Complemento" value={form.complemento} onChange={(v) => setFF('complemento', v)} />
          <Field label="Bairro" value={form.bairro} onChange={(v) => setFF('bairro', v)} />
          <Field
            label="Cód. município (IBGE)"
            value={form.codigoMunicipio}
            onChange={(v) => setFF('codigoMunicipio', v.replace(/\D/g, '').slice(0, 7))}
            maxLen={7}
          />
          <Field
            label="Inscrição Estadual"
            value={form.inscricaoEstadual}
            onChange={(v) => setFF('inscricaoEstadual', v)}
          />
          <Field
            label="Inscrição Municipal"
            value={form.inscricaoMunicipal}
            onChange={(v) => setFF('inscricaoMunicipal', v)}
          />
        </div>

        {!isNew && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFF('ativa', !form.ativa)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.ativa ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.ativa ? 'translate-x-4' : 'translate-x-0.5'}`}
              />
            </button>
            <label className="text-sm text-slate-700 dark:text-slate-300">
              {form.ativa ? 'Filial ativa' : 'Filial inativa'}
            </label>
          </div>
        )}

        {isAdmin && isNew && (
          <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
            Depois de salvar a filial, use <strong className="text-slate-600 dark:text-slate-300">Editar</strong>{' '}
            para enviar certificado A1 próprio da filial, se ela emitir NF-e com CNPJ diferente da matriz.
          </p>
        )}

        {isAdmin && !isNew && (
          <div className="border-t border-slate-200 dark:border-slate-700 pt-5 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Certificado digital (e-CNPJ A1) — filial
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Se esta filial <strong className="text-slate-600 dark:text-slate-300">emite notas com CNPJ próprio</strong>,
              envie o e-CNPJ A1 desse CNPJ.
            </p>
            {!certStorageReady && (
              <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                O envio do certificado ainda não está disponível aqui. Configure depois editando esta filial
                novamente.
              </p>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {uploadedAt
                ? `Certificado enviado em ${fmtDate(uploadedAt)}. Envie outro arquivo para substituir.`
                : 'Nenhum certificado específico desta filial.'}
            </p>
            {meta && <CertMetaDetails meta={meta} />}
            {uploadedAt && certStorageReady && (
              <button
                type="button"
                onClick={syncCertMeta}
                disabled={certSyncBusy || certBusy}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {certSyncBusy ? 'Atualizando…' : meta ? 'Recarregar dados do certificado' : 'Carregar validade e titular'}
              </button>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Arquivo .pfx ou .p12
                </label>
                <input
                  type="file"
                  accept=".pfx,.p12"
                  disabled={!certStorageReady || certBusy || certSyncBusy}
                  onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-brand-600 file:px-2 file:py-1 file:text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Senha do certificado
                </label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={certPwd}
                  onChange={(e) => setCertPwd(e.target.value)}
                  disabled={!certStorageReady || certBusy || certSyncBusy}
                  className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={uploadCert}
              disabled={!certStorageReady || certBusy || certSyncBusy}
              className="text-sm px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              {certBusy ? 'Enviando…' : 'Enviar certificado da filial'}
            </button>
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={() => navigate('/configuracoes/filiais')} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving} disabled={isNew && !empresaId}>
            Salvar
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
