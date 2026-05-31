import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';
import { authService } from '../../services/auth';
import MaskedInput from '../../components/common/MaskedInput';
import { formatApiError } from '../../utils/helpers';
import { fetchCepComIbge } from '../../services/brasilCepIbge';
import type { ComponentProps } from 'react';

// v2 – CEP auto-fill + reorder (CNPJ|CEP, Cidade|UF)
const UF_LIST = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('pt-BR') : '—';
const fmtDateTime = (s?: string) => s ? new Date(s).toLocaleString('pt-BR') : '—';

/** Metadados públicos do certificado A1 (API / D1). */
type A1CertMeta = {
  subjectCn: string | null;
  subjectDn: string | null;
  issuerCn: string | null;
  issuerDn: string | null;
  serialNumber: string | null;
  validFrom: string;
  validTo: string;
  thumbprintSha256: string;
};

function parseA1CertMeta(raw: unknown): A1CertMeta | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && raw !== null && 'validTo' in raw && typeof (raw as A1CertMeta).validTo === 'string') {
    return raw as A1CertMeta;
  }
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as A1CertMeta;
      return o?.validTo ? o : null;
    } catch { return null; }
  }
  return null;
}

function certValidityHint(validTo: string): { text: string; expired: boolean; soon: boolean } {
  const end = new Date(validTo);
  const now = new Date();
  if (end < now) return { text: 'Certificado expirado', expired: true, soon: false };
  const days = Math.ceil((end.getTime() - now.getTime()) / 864e5);
  if (days <= 30) return { text: `Expira em ${days} dia(s)`, expired: false, soon: true };
  return { text: `Válido até ${fmtDate(validTo)}`, expired: false, soon: false };
}

function CertMetaDetails({ meta }: { meta: A1CertMeta }) {
  const v = certValidityHint(meta.validTo);
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 space-y-1.5">
      <p className="font-medium text-slate-800 dark:text-slate-100">
        {meta.subjectCn || meta.subjectDn || 'Titular (CN) não identificado'}
      </p>
      {meta.subjectDn && meta.subjectCn && (
        <p className="text-slate-500 dark:text-slate-400 break-words leading-snug">{meta.subjectDn}</p>
      )}
      <p>
        <span className="text-slate-500 dark:text-slate-400">Válido: </span>
        {fmtDateTime(meta.validFrom)} — {fmtDateTime(meta.validTo)}
      </p>
      <p className={v.expired ? 'text-red-600 dark:text-red-400 font-medium' : v.soon ? 'text-amber-700 dark:text-amber-300 font-medium' : 'text-emerald-700 dark:text-emerald-400'}>
        {v.text}
      </p>
      {(meta.issuerCn || meta.issuerDn) && (
        <p className="text-slate-500 dark:text-slate-400 break-words">
          <span className="font-medium text-slate-600 dark:text-slate-300">Emissor: </span>
          {meta.issuerCn || meta.issuerDn}
        </p>
      )}
      {meta.serialNumber && (
        <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500 break-all">Série: {meta.serialNumber}</p>
      )}
    </div>
  );
}

interface Empresa {
  id: string; razao_social: string; nome_fantasia?: string; cnpj?: string;
  inscricao_estadual?: string | null;
  cidade?: string; uf?: string; email?: string; telefone?: string;
  logradouro?: string; numero?: string; complemento?: string | null; bairro?: string; cep?: string;
  codigo_municipio?: string | null;
  crt?: string | null;
  cnae?: string | null;
  nfe_serie?: string | null;
  nfe_ambiente?: number | null;
  nfe_proximo_numero?: number | null;
  total_filiais?: number; created_at: string;
  a1_cert_uploaded_at?: string | null;
  a1_cert_meta?: string | null;
}
interface Filial {
  id: string; nome: string; cnpj?: string; uf?: string; cidade?: string;
  logradouro?: string; numero?: string; complemento?: string | null; bairro?: string; cep?: string;
  codigo_municipio?: string | null;
  inscricao_estadual?: string | null;
  ativa: number; empresa_id: string; empresa_nome?: string; created_at?: string;
  a1_cert_uploaded_at?: string | null;
  a1_cert_meta?: string | null;
}

/** Garante leitura dos campos A1 mesmo se a API/proxy variar o casing. */
function normalizeEmpresaRow(row: unknown): Empresa {
  const r = row as Record<string, unknown> & Partial<Empresa>;
  const up = r.a1_cert_uploaded_at ?? r.a1CertUploadedAt;
  const meta = r.a1_cert_meta ?? r.a1CertMeta;
  return {
    ...(r as Empresa),
    a1_cert_uploaded_at: up != null && String(up) !== '' ? String(up) : null,
    a1_cert_meta:
      meta == null || meta === ''
        ? null
        : typeof meta === 'string'
          ? meta
          : JSON.stringify(meta),
  };
}

function normalizeFilialRow(row: unknown): Filial {
  const r = row as Record<string, unknown> & Partial<Filial>;
  const up = r.a1_cert_uploaded_at ?? r.a1CertUploadedAt;
  const meta = r.a1_cert_meta ?? r.a1CertMeta;
  return {
    ...(r as Filial),
    a1_cert_uploaded_at: up != null && String(up) !== '' ? String(up) : null,
    a1_cert_meta:
      meta == null || meta === ''
        ? null
        : typeof meta === 'string'
          ? meta
          : JSON.stringify(meta),
  };
}

type EmpresaForm = {
  razaoSocial: string; nomeFantasia: string; cnpj: string; inscricaoEstadual: string;
  email: string; telefone: string; uf: string; cidade: string; logradouro: string; numero: string;
  complemento: string; bairro: string; cep: string;
  codigoMunicipio: string; crt: string; cnae: string; nfeSerie: string; nfeAmbiente: string; nfeProximoNumero: string;
};
type FilialForm = {
  nome: string; cnpj: string; uf: string; cidade: string; logradouro: string; numero: string;
  complemento: string; bairro: string; cep: string;
  codigoMunicipio: string; inscricaoEstadual: string;
  ativa: boolean;
};

const emptyEmpresa = (): EmpresaForm => ({
  razaoSocial: '', nomeFantasia: '', cnpj: '', inscricaoEstadual: '',
  email: '', telefone: '', uf: 'SC', cidade: '', logradouro: '', numero: '',
  complemento: '', bairro: '', cep: '',
  codigoMunicipio: '', crt: '1', cnae: '', nfeSerie: '1', nfeAmbiente: '2', nfeProximoNumero: '1',
});
const emptyFilial = (): FilialForm => ({
  nome: '', cnpj: '', uf: 'SC', cidade: '', logradouro: '', numero: '',
  complemento: '', bairro: '', cep: '',
  codigoMunicipio: '', inscricaoEstadual: '',
  ativa: true,
});

const FIELD_CLS = 'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

function Field({ label, value, onChange, type = 'text', required, placeholder, maxLen }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; maxLen?: number; }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLen}
        className={FIELD_CLS} />
    </div>
  );
}

function MaskedField({ label, required, ...props }: { label: string; required?: boolean } & ComponentProps<typeof MaskedInput>) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <MaskedInput className={FIELD_CLS} {...props} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[]; }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

export function FiliaisPage() {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedEmpresa, setExpandedEmpresa] = useState<string | null>(null);

  // Modal empresa
  const [showEmpresaModal, setShowEmpresaModal] = useState(false);
  const [empresaEditing, setEmpresaEditing] = useState<string | null>(null);
  const [empresaForm, setEmpresaForm] = useState(emptyEmpresa());
  const [empresaSaving, setEmpresaSaving] = useState(false);
  const [empresaModalError, setEmpresaModalError] = useState('');

  // Modal filial
  const [showFilialModal, setShowFilialModal] = useState(false);
  const [filialEditing, setFilialEditing] = useState<string | null>(null);
  const [filialParentId, setFilialParentId] = useState<string | null>(null);
  const [filialForm, setFilialForm] = useState(emptyFilial());
  const [filialSaving, setFilialSaving] = useState(false);
  const [filialModalError, setFilialModalError] = useState('');

  const [loadingCepFilial, setLoadingCepFilial] = useState(false);
  const [loadingCepEmpresa, setLoadingCepEmpresa] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<{ tipo: 'empresa' | 'filial'; id: string } | null>(null);

  const [certStorageReady, setCertStorageReady] = useState(false);
  const [empresaCertFile, setEmpresaCertFile] = useState<File | null>(null);
  const [empresaCertPwd, setEmpresaCertPwd] = useState('');
  const [empresaCertBusy, setEmpresaCertBusy] = useState(false);
  const [filialCertFile, setFilialCertFile] = useState<File | null>(null);
  const [filialCertPwd, setFilialCertPwd] = useState('');
  const [filialCertBusy, setFilialCertBusy] = useState(false);
  const [empresaCertSyncBusy, setEmpresaCertSyncBusy] = useState(false);
  const [filialCertSyncBusy, setFilialCertSyncBusy] = useState(false);

  const isAdmin = (authService.getLocalUser() as { role?: string } | null)?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [eRes, fRes] = await Promise.all([
        api.get('/tenant/info/empresas'),
        api.get('/tenant/info/filiais'),
      ]);
      setEmpresas((eRes.data.empresas ?? []).map(normalizeEmpresaRow));
      setFiliais((fRes.data.filiais ?? []).map(normalizeFilialRow));
    } catch { setError('Erro ao carregar dados.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/tenant/info/onboarding')
      .then((r) => setCertStorageReady(!!r.data.certificateStorageReady))
      .catch(() => setCertStorageReady(false));
  }, []);

  // ── Empresa ────────────────────────────────────────────

  const openNewEmpresa = () => {
    setEmpresaForm(emptyEmpresa()); setEmpresaEditing(null); setEmpresaModalError('');
    setEmpresaCertFile(null); setEmpresaCertPwd('');
    setShowEmpresaModal(true);
  };

  const openEditEmpresa = async (e: Empresa) => {
    setEmpresaModalError('');
    setEmpresaCertFile(null); setEmpresaCertPwd('');
    let row = normalizeEmpresaRow(e);
    try {
      const eRes = await api.get('/tenant/info/empresas');
      const list = (eRes.data.empresas ?? []).map(normalizeEmpresaRow);
      setEmpresas(list);
      const found = list.find((x: Empresa) => x.id === e.id);
      if (found) row = found;
    } catch {
      /* mantém dados do cartão clicado */
    }
    setEmpresaForm({
      razaoSocial: row.razao_social, nomeFantasia: row.nome_fantasia ?? '', cnpj: row.cnpj ?? '',
      inscricaoEstadual: row.inscricao_estadual ?? '',
      email: row.email ?? '', telefone: row.telefone ?? '', uf: row.uf ?? 'SC', cidade: row.cidade ?? '',
      logradouro: row.logradouro ?? '', numero: row.numero ?? '', complemento: row.complemento ?? '',
      bairro: row.bairro ?? '', cep: row.cep ?? '',
      codigoMunicipio: row.codigo_municipio ?? '',
      crt: row.crt ?? '1',
      cnae: row.cnae ?? '',
      nfeSerie: row.nfe_serie ?? '1',
      nfeAmbiente: row.nfe_ambiente != null ? String(row.nfe_ambiente) : '2',
      nfeProximoNumero: row.nfe_proximo_numero != null ? String(row.nfe_proximo_numero) : '1',
    });
    setEmpresaEditing(row.id);
    setShowEmpresaModal(true);
  };

  const setEF = (k: keyof EmpresaForm, v: string) => setEmpresaForm(f => ({ ...f, [k]: v }));

  const saveEmpresa = async () => {
    if (!empresaForm.razaoSocial.trim()) { setEmpresaModalError('Razão social é obrigatória.'); return; }
    if (!empresaForm.cnpj.trim() || empresaForm.cnpj.length !== 14) { setEmpresaModalError('CNPJ inválido (somente números, 14 dígitos).'); return; }
    setEmpresaSaving(true); setEmpresaModalError('');
    try {
      const payload = {
        ...empresaForm,
        nfeAmbiente: Number(empresaForm.nfeAmbiente) || 2,
        nfeProximoNumero: Number(empresaForm.nfeProximoNumero) || 1,
      };
      if (empresaEditing) {
        await api.put(`/tenant/info/empresas/${empresaEditing}`, payload);
      } else {
        await api.post('/tenant/info/empresas', payload);
      }
      setShowEmpresaModal(false); load();
    } catch (err: unknown) {
      setEmpresaModalError(formatApiError(err, 'Erro ao salvar empresa.'));
    } finally { setEmpresaSaving(false); }
  };

  // ── Filial ──────────────────────────────────────────────

  const openNewFilial = (empresaId: string) => {
    setFilialForm(emptyFilial()); setFilialEditing(null); setFilialParentId(empresaId); setFilialModalError('');
    setFilialCertFile(null); setFilialCertPwd('');
    setShowFilialModal(true);
  };

  const openEditFilial = async (f: Filial) => {
    setFilialModalError('');
    setFilialCertFile(null); setFilialCertPwd('');
    let row = normalizeFilialRow(f);
    try {
      const fRes = await api.get('/tenant/info/filiais');
      const list = (fRes.data.filiais ?? []).map(normalizeFilialRow);
      setFiliais(list);
      const found = list.find((x: Filial) => x.id === f.id);
      if (found) row = found;
    } catch {
      /* mantém dados do cartão clicado */
    }
    setFilialForm({
      nome: row.nome, cnpj: row.cnpj ?? '', uf: row.uf ?? 'SC', cidade: row.cidade ?? '',
      logradouro: row.logradouro ?? '', numero: row.numero ?? '', complemento: row.complemento ?? '',
      bairro: row.bairro ?? '', cep: row.cep ?? '',
      codigoMunicipio: row.codigo_municipio ?? '',
      inscricaoEstadual: row.inscricao_estadual ?? '',
      ativa: row.ativa === 1,
    });
    setFilialEditing(row.id); setFilialParentId(row.empresa_id);
    setShowFilialModal(true);
  };

  const uploadEmpresaCert = async () => {
    if (!empresaEditing || !empresaCertFile || !empresaCertPwd.trim()) {
      setEmpresaModalError('Selecione o arquivo .pfx ou .p12 e informe a senha.');
      return;
    }
    setEmpresaCertBusy(true); setEmpresaModalError('');
    try {
      const fd = new FormData();
      fd.append('file', empresaCertFile);
      fd.append('password', empresaCertPwd);
      await api.post(`/tenant/info/empresas/${empresaEditing}/certificado-a1`, fd);
      setEmpresaCertFile(null); setEmpresaCertPwd('');
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setEmpresaModalError(ax.response?.data?.error || 'Erro ao enviar certificado.');
    } finally {
      setEmpresaCertBusy(false);
    }
  };

  const uploadFilialCert = async () => {
    if (!filialEditing || !filialCertFile || !filialCertPwd.trim()) {
      setFilialModalError('Selecione o arquivo .pfx ou .p12 e informe a senha.');
      return;
    }
    setFilialCertBusy(true); setFilialModalError('');
    try {
      const fd = new FormData();
      fd.append('file', filialCertFile);
      fd.append('password', filialCertPwd);
      await api.post(`/tenant/info/filiais/${filialEditing}/certificado-a1`, fd);
      setFilialCertFile(null); setFilialCertPwd('');
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFilialModalError(ax.response?.data?.error || 'Erro ao enviar certificado.');
    } finally {
      setFilialCertBusy(false);
    }
  };

  const syncEmpresaCertMeta = async () => {
    if (!empresaEditing) return;
    setEmpresaCertSyncBusy(true); setEmpresaModalError('');
    try {
      await api.post(`/tenant/info/empresas/${empresaEditing}/certificado-a1/atualizar-metadados`);
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setEmpresaModalError(ax.response?.data?.error || 'Erro ao atualizar dados do certificado.');
    } finally {
      setEmpresaCertSyncBusy(false);
    }
  };

  const syncFilialCertMeta = async () => {
    if (!filialEditing) return;
    setFilialCertSyncBusy(true); setFilialModalError('');
    try {
      await api.post(`/tenant/info/filiais/${filialEditing}/certificado-a1/atualizar-metadados`);
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setFilialModalError(ax.response?.data?.error || 'Erro ao atualizar dados do certificado.');
    } finally {
      setFilialCertSyncBusy(false);
    }
  };

  // Auto-busca CEP da filial quando atingir 8 dígitos
  const filialCepRef = useRef('');
  useEffect(() => {
    const digits = filialForm.cep.replace(/\D/g, '');
    if (digits.length === 8 && digits !== filialCepRef.current) {
      filialCepRef.current = digits;
      setLoadingCepFilial(true);
      fetchCepComIbge(digits).then(data => {
        if (data) {
          setFilialForm(f => ({
            ...f,
            logradouro: data.logradouro || f.logradouro,
            bairro: data.bairro || f.bairro,
            cidade: data.cidade || f.cidade,
            uf: data.uf || f.uf,
            codigoMunicipio: data.codigoMunicipioIbge || f.codigoMunicipio,
          }));
        }
      }).finally(() => setLoadingCepFilial(false));
    }
    if (digits.length < 8) filialCepRef.current = '';
  }, [filialForm.cep]);

  // Auto-busca CEP da empresa quando atingir 8 dígitos
  const empresaCepRef = useRef('');
  useEffect(() => {
    const digits = empresaForm.cep.replace(/\D/g, '');
    if (digits.length === 8 && digits !== empresaCepRef.current) {
      empresaCepRef.current = digits;
      setLoadingCepEmpresa(true);
      fetchCepComIbge(digits).then(data => {
        if (data) {
          setEmpresaForm(f => ({
            ...f,
            logradouro: data.logradouro || f.logradouro,
            bairro: data.bairro || f.bairro,
            cidade: data.cidade || f.cidade,
            uf: data.uf || f.uf,
            codigoMunicipio: data.codigoMunicipioIbge || f.codigoMunicipio,
          }));
        }
      }).finally(() => setLoadingCepEmpresa(false));
    }
    if (digits.length < 8) empresaCepRef.current = '';
  }, [empresaForm.cep]);

  const setFF = (k: keyof FilialForm, v: string | boolean) => setFilialForm(f => ({ ...f, [k]: v }));

  const saveFilial = async () => {
    if (!filialForm.nome.trim()) { setFilialModalError('Nome da filial é obrigatório.'); return; }
    setFilialSaving(true); setFilialModalError('');
    try {
      const payload = { ...filialForm, ativa: filialForm.ativa };
      if (filialEditing) {
        await api.put(`/tenant/info/filiais/${filialEditing}`, payload);
      } else {
        await api.post(`/tenant/info/empresas/${filialParentId}/filiais`, payload);
      }
      setShowFilialModal(false); load();
    } catch (err: unknown) {
      setFilialModalError(formatApiError(err, 'Erro ao salvar filial.'));
    } finally { setFilialSaving(false); }
  };

  // ── Delete ──────────────────────────────────────────────

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.tipo === 'empresa') {
        await api.delete(`/tenant/info/empresas/${deleteTarget.id}`);
      } else {
        await api.delete(`/tenant/info/filiais/${deleteTarget.id}`);
      }
      setDeleteTarget(null); load();
    } catch (err: unknown) {
      setError(formatApiError(err, 'Erro ao excluir.')); setDeleteTarget(null);
    }
  };

  const filiaisDaEmpresa = (id: string) => filiais.filter(f => f.empresa_id === id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">Empresas e Filiais</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{empresas.length} empresa(s) · {filiais.length} filial(is)</p>
        </div>
        <button onClick={openNewEmpresa} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nova Empresa
        </button>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><svg className="animate-spin w-7 h-7 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
      ) : empresas.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-16 text-center">
          <svg className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
          <p className="text-slate-400 dark:text-slate-500 mb-4 text-sm">Nenhuma empresa cadastrada</p>
          <button onClick={openNewEmpresa} className="px-4 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700">Cadastrar primeira empresa</button>
        </div>
      ) : (
        <div className="space-y-3">
          {empresas.map(empresa => {
            const filiaisE = filiaisDaEmpresa(empresa.id);
            const expanded = expandedEmpresa === empresa.id;
            const empresaCertMeta = parseA1CertMeta(empresa.a1_cert_meta);
            return (
              <div key={empresa.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors" onClick={() => setExpandedEmpresa(expanded ? null : empresa.id)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 flex items-center justify-center flex-none">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" /></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{empresa.razao_social}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-2">
                        <span>{empresa.nome_fantasia || empresa.cnpj || 'CNPJ não informado'} · {filiaisE.length} filial(is)</span>
                        {empresa.a1_cert_uploaded_at && (
                          <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">A1 matriz</span>
                        )}
                        {empresaCertMeta && (() => {
                          const h = certValidityHint(empresaCertMeta.validTo);
                          return (
                            <span className={`text-[10px] ${h.expired ? 'text-red-600 dark:text-red-400' : h.soon ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
                              {h.expired || h.soon ? h.text : `até ${fmtDate(empresaCertMeta.validTo)}`}
                            </span>
                          );
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button onClick={e => { e.stopPropagation(); openEditEmpresa(empresa); }} className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium px-2 py-1">Editar</button>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget({ tipo: 'empresa', id: empresa.id }); }} className="text-xs text-red-500 hover:underline font-medium px-2 py-1">Excluir</button>
                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800">
                    {/* Detalhes da empresa */}
                    {(empresa.cidade || empresa.uf || empresa.email) && (
                      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-4">
                        {empresa.cidade && <span>{empresa.cidade}{empresa.uf ? ` / ${empresa.uf}` : ''}</span>}
                        {empresa.email && <span>{empresa.email}</span>}
                        {empresa.telefone && <span>{empresa.telefone}</span>}
                        <span>Cadastrada em {fmtDate(empresa.created_at)}</span>
                      </div>
                    )}

                    {/* Filiais */}
                    <div className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Filiais ({filiaisE.length})</p>
                        <button onClick={() => openNewFilial(empresa.id)} className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                          Nova Filial
                        </button>
                      </div>
                      {filiaisE.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500 italic">Nenhuma filial cadastrada para esta empresa.</p>
                      ) : (
                        <div className="space-y-2">
                          {filiaisE.map(filial => {
                            const filialCertMeta = parseA1CertMeta(filial.a1_cert_meta);
                            return (
                            <div key={filial.id} className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg px-4 py-2.5">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-2 h-2 rounded-full flex-none ${filial.ativa === 1 ? 'bg-emerald-400' : 'bg-slate-300 dark:bg-slate-600'}`} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{filial.nome}</p>
                                  <p className="text-xs text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-2">
                                    <span>{filial.cidade && filial.uf ? `${filial.cidade}/${filial.uf}` : filial.cnpj || '—'}</span>
                                    {filial.a1_cert_uploaded_at && (
                                      <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-semibold">A1 filial</span>
                                    )}
                                    {filialCertMeta && (() => {
                                      const h = certValidityHint(filialCertMeta.validTo);
                                      return (
                                        <span className={`text-[10px] ${h.expired ? 'text-red-600 dark:text-red-400' : h.soon ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
                                          {h.expired || h.soon ? h.text : `até ${fmtDate(filialCertMeta.validTo)}`}
                                        </span>
                                      );
                                    })()}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4 flex-none">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${filial.ativa === 1 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{filial.ativa === 1 ? 'Ativa' : 'Inativa'}</span>
                                <button onClick={() => openEditFilial(filial)} className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium">Editar</button>
                                <button onClick={() => setDeleteTarget({ tipo: 'filial', id: filial.id })} className="text-xs text-red-500 hover:underline font-medium">Excluir</button>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Empresa */}
      {showEmpresaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{empresaEditing ? 'Editar Empresa' : 'Nova Empresa'}</h2>
              <button onClick={() => setShowEmpresaModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-5">
              {empresaModalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{empresaModalError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Field label="Razão Social" value={empresaForm.razaoSocial} onChange={v => setEF('razaoSocial', v)} required /></div>
                <Field label="Nome Fantasia" value={empresaForm.nomeFantasia} onChange={v => setEF('nomeFantasia', v)} />
                <MaskedField label="CNPJ" mask="cnpj" value={empresaForm.cnpj} onChange={v => setEF('cnpj', v)} required placeholder="00.000.000/0000-00" />
                <Field label="E-mail" value={empresaForm.email} onChange={v => setEF('email', v)} type="email" />
                <MaskedField label="Telefone" mask="phone" value={empresaForm.telefone} onChange={v => setEF('telefone', v)} placeholder="(48) 99999-9999" />
                <div className="col-span-2"><Field label="Logradouro" value={empresaForm.logradouro} onChange={v => setEF('logradouro', v)} /></div>
                <Field label="Número" value={empresaForm.numero} onChange={v => setEF('numero', v)} />
                <Field label="Bairro" value={empresaForm.bairro} onChange={v => setEF('bairro', v)} />
                <Field label="Cidade" value={empresaForm.cidade} onChange={v => setEF('cidade', v)} />
                <SelectField label="UF" value={empresaForm.uf} onChange={v => setEF('uf', v)} options={UF_LIST} />
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">CEP</label>
                  <div className="relative">
                    <MaskedInput mask="cep" value={empresaForm.cep} onChange={v => setEF('cep', v)} placeholder="00000-000" className={FIELD_CLS} />
                    {loadingCepEmpresa && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <svg className="animate-spin w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      </div>
                    )}
                  </div>
                </div>
                <Field label="Complemento" value={empresaForm.complemento} onChange={v => setEF('complemento', v)} />
                <Field label="Inscrição Estadual" value={empresaForm.inscricaoEstadual} onChange={v => setEF('inscricaoEstadual', v)} />
                <Field label="Cód. município (IBGE)" value={empresaForm.codigoMunicipio} onChange={v => setEF('codigoMunicipio', v.replace(/\D/g, '').slice(0, 7))} maxLen={7} />
                <SelectField label="CRT (regime tributário)" value={empresaForm.crt} onChange={v => setEF('crt', v)} options={['1', '2', '3']} />
                <Field label="CNAE (principal)" value={empresaForm.cnae} onChange={v => setEF('cnae', v)} />
                <Field label="Série NF-e" value={empresaForm.nfeSerie} onChange={v => setEF('nfeSerie', v)} maxLen={3} />
                <SelectField label="Ambiente NF-e" value={empresaForm.nfeAmbiente} onChange={v => setEF('nfeAmbiente', v)} options={['1', '2']} />
                <Field label="Próximo nº NF-e" value={empresaForm.nfeProximoNumero} onChange={v => setEF('nfeProximoNumero', v.replace(/\D/g, ''))} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                CRT: 1 Simples Nacional · 2 Simples excesso · 3 Regime normal. Ambiente: 1 produção · 2 homologação (testes).
              </p>

              {isAdmin && !empresaEditing && (
                <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
                  Depois de salvar, use <strong className="text-slate-600 dark:text-slate-300">Editar</strong> para enviar o certificado digital A1 da matriz, se necessário.
                </p>
              )}

              {isAdmin && empresaEditing && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Certificado digital (e-CNPJ A1) — empresa</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Vinculado ao CNPJ desta empresa (matriz). Use quando as notas forem emitidas em nome deste CNPJ.
                  </p>
                  {!certStorageReady && (
                    <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      O envio do certificado ainda não está disponível aqui. Você poderá configurar depois no mesmo lugar (editar esta empresa).
                    </p>
                  )}
                  {(() => {
                    const eRow = empresas.find((x) => x.id === empresaEditing);
                    const uploadedAt = eRow?.a1_cert_uploaded_at;
                    const meta = parseA1CertMeta(eRow?.a1_cert_meta);
                    return (
                      <>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {uploadedAt
                            ? `Certificado enviado em ${fmtDate(uploadedAt)}. Envie outro arquivo para substituir.`
                            : 'Nenhum certificado cadastrado para esta empresa.'}
                        </p>
                        {!uploadedAt && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border border-dashed border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40">
                            Só aparece como enviado depois de clicar em <strong className="text-slate-700 dark:text-slate-200">Enviar certificado</strong> e a API confirmar (não basta salvar a empresa).
                            Se você pulou o certificado no onboarding ou o armazenamento ainda não estava configurado, selecione o .pfx/.p12 e a senha abaixo e envie de novo.
                          </p>
                        )}
                        {meta && <CertMetaDetails meta={meta} />}
                        {uploadedAt && certStorageReady && (
                          <button
                            type="button"
                            onClick={syncEmpresaCertMeta}
                            disabled={empresaCertSyncBusy || empresaCertBusy}
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                          >
                            {empresaCertSyncBusy ? 'Atualizando…' : meta ? 'Recarregar dados do certificado' : 'Carregar validade e titular'}
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Arquivo .pfx ou .p12</label>
                      <input
                        type="file"
                        accept=".pfx,.p12"
                        disabled={!certStorageReady || empresaCertBusy || empresaCertSyncBusy}
                        onChange={(e) => setEmpresaCertFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-brand-600 file:px-2 file:py-1 file:text-white disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Senha do certificado</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={empresaCertPwd}
                        onChange={(e) => setEmpresaCertPwd(e.target.value)}
                        disabled={!certStorageReady || empresaCertBusy || empresaCertSyncBusy}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={uploadEmpresaCert}
                    disabled={!certStorageReady || empresaCertBusy || empresaCertSyncBusy}
                    className="text-sm px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
                  >
                    {empresaCertBusy ? 'Enviando…' : 'Enviar certificado'}
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowEmpresaModal(false)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                <button onClick={saveEmpresa} disabled={empresaSaving} className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">{empresaSaving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Filial */}
      {showFilialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{filialEditing ? 'Editar Filial' : 'Nova Filial'}</h2>
              <button onClick={() => setShowFilialModal(false)} className="text-slate-400 hover:text-slate-600"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-5">
              {filialModalError && <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-sm">{filialModalError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><Field label="Nome da Filial" value={filialForm.nome} onChange={v => setFF('nome', v)} required /></div>
                <MaskedField label="CNPJ" mask="cnpj" value={filialForm.cnpj} onChange={v => setFF('cnpj', v)} placeholder="00.000.000/0000-00" />
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">CEP</label>
                  <div className="relative">
                    <MaskedInput mask="cep" value={filialForm.cep} onChange={v => setFF('cep', v)} placeholder="00000-000" className={FIELD_CLS} />
                    {loadingCepFilial && (
                      <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        <svg className="animate-spin w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      </div>
                    )}
                  </div>
                </div>
                <Field label="Cidade" value={filialForm.cidade} onChange={v => setFF('cidade', v)} />
                <SelectField label="UF" value={filialForm.uf} onChange={v => setFF('uf', v)} options={UF_LIST} />
                <div className="col-span-2"><Field label="Logradouro" value={filialForm.logradouro} onChange={v => setFF('logradouro', v)} /></div>
                <Field label="Número" value={filialForm.numero} onChange={v => setFF('numero', v)} />
                <Field label="Complemento" value={filialForm.complemento} onChange={v => setFF('complemento', v)} />
                <Field label="Bairro" value={filialForm.bairro} onChange={v => setFF('bairro', v)} />
                <Field label="Cód. município (IBGE)" value={filialForm.codigoMunicipio} onChange={v => setFF('codigoMunicipio', v.replace(/\D/g, '').slice(0, 7))} maxLen={7} />
                <Field label="Inscrição Estadual" value={filialForm.inscricaoEstadual} onChange={v => setFF('inscricaoEstadual', v)} />
              </div>
              {filialEditing && (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setFF('ativa', !filialForm.ativa)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${filialForm.ativa ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${filialForm.ativa ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <label className="text-sm text-slate-700 dark:text-slate-300">{filialForm.ativa ? 'Filial ativa' : 'Filial inativa'}</label>
                </div>
              )}

              {isAdmin && !filialEditing && (
                <p className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4">
                  Depois de salvar a filial, use <strong className="text-slate-600 dark:text-slate-300">Editar</strong> para enviar certificado A1 próprio da filial, se ela emitir NF-e com CNPJ diferente da matriz.
                </p>
              )}

              {isAdmin && filialEditing && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-5 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Certificado digital (e-CNPJ A1) — filial</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Se esta filial <strong className="text-slate-600 dark:text-slate-300">emite notas com CNPJ próprio</strong>, envie o e-CNPJ A1 desse CNPJ. Se todas as notas saem pelo CNPJ da matriz, em geral basta o certificado cadastrado na empresa.
                  </p>
                  {!certStorageReady && (
                    <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                      O envio do certificado ainda não está disponível aqui. Configure depois editando esta filial novamente.
                    </p>
                  )}
                  {(() => {
                    const fRow = filiais.find((x) => x.id === filialEditing);
                    const uploadedAt = fRow?.a1_cert_uploaded_at;
                    const meta = parseA1CertMeta(fRow?.a1_cert_meta);
                    return (
                      <>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {uploadedAt
                            ? `Certificado enviado em ${fmtDate(uploadedAt)}. Envie outro arquivo para substituir.`
                            : 'Nenhum certificado específico desta filial.'}
                        </p>
                        {!uploadedAt && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed border border-dashed border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-slate-50/80 dark:bg-slate-800/40">
                            O certificado da filial só é gravado após <strong className="text-slate-700 dark:text-slate-200">Enviar certificado da filial</strong> com arquivo e senha válidos.
                          </p>
                        )}
                        {meta && <CertMetaDetails meta={meta} />}
                        {uploadedAt && certStorageReady && (
                          <button
                            type="button"
                            onClick={syncFilialCertMeta}
                            disabled={filialCertSyncBusy || filialCertBusy}
                            className="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                          >
                            {filialCertSyncBusy ? 'Atualizando…' : meta ? 'Recarregar dados do certificado' : 'Carregar validade e titular'}
                          </button>
                        )}
                      </>
                    );
                  })()}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Arquivo .pfx ou .p12</label>
                      <input
                        type="file"
                        accept=".pfx,.p12"
                        disabled={!certStorageReady || filialCertBusy || filialCertSyncBusy}
                        onChange={(e) => setFilialCertFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-xs text-slate-600 dark:text-slate-300 file:mr-2 file:rounded file:border-0 file:bg-brand-600 file:px-2 file:py-1 file:text-white disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Senha do certificado</label>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={filialCertPwd}
                        onChange={(e) => setFilialCertPwd(e.target.value)}
                        disabled={!certStorageReady || filialCertBusy || filialCertSyncBusy}
                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={uploadFilialCert}
                    disabled={!certStorageReady || filialCertBusy || filialCertSyncBusy}
                    className="text-sm px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
                  >
                    {filialCertBusy ? 'Enviando…' : 'Enviar certificado da filial'}
                  </button>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowFilialModal(false)} className="flex-1 px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
                <button onClick={saveFilial} disabled={filialSaving} className="flex-1 px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50">{filialSaving ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Excluir {deleteTarget.tipo === 'empresa' ? 'empresa' : 'filial'}?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {deleteTarget.tipo === 'empresa' ? 'Todas as filiais vinculadas também serão removidas. ' : ''}Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 px-4 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Cancelar</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FiliaisPage;
