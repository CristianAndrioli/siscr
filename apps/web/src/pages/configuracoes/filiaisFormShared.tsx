import type { ComponentProps } from 'react';
import MaskedInput from '../../components/common/MaskedInput';

export const UF_LIST = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
  'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
export const fmtDateTime = (s?: string) => (s ? new Date(s).toLocaleString('pt-BR') : '—');

export type A1CertMeta = {
  subjectCn: string | null;
  subjectDn: string | null;
  issuerCn: string | null;
  issuerDn: string | null;
  serialNumber: string | null;
  validFrom: string;
  validTo: string;
  thumbprintSha256: string;
};

export function parseA1CertMeta(raw: unknown): A1CertMeta | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object' && raw !== null && 'validTo' in raw && typeof (raw as A1CertMeta).validTo === 'string') {
    return raw as A1CertMeta;
  }
  if (typeof raw === 'string') {
    try {
      const o = JSON.parse(raw) as A1CertMeta;
      return o?.validTo ? o : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function certValidityHint(validTo: string): { text: string; expired: boolean; soon: boolean } {
  const end = new Date(validTo);
  const now = new Date();
  if (end < now) return { text: 'Certificado expirado', expired: true, soon: false };
  const days = Math.ceil((end.getTime() - now.getTime()) / 864e5);
  if (days <= 30) return { text: `Expira em ${days} dia(s)`, expired: false, soon: true };
  return { text: `Válido até ${fmtDate(validTo)}`, expired: false, soon: false };
}

export function CertMetaDetails({ meta }: { meta: A1CertMeta }) {
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
      <p
        className={
          v.expired
            ? 'text-red-600 dark:text-red-400 font-medium'
            : v.soon
              ? 'text-amber-700 dark:text-amber-300 font-medium'
              : 'text-emerald-700 dark:text-emerald-400'
        }
      >
        {v.text}
      </p>
      {(meta.issuerCn || meta.issuerDn) && (
        <p className="text-slate-500 dark:text-slate-400 break-words">
          <span className="font-medium text-slate-600 dark:text-slate-300">Emissor: </span>
          {meta.issuerCn || meta.issuerDn}
        </p>
      )}
      {meta.serialNumber && (
        <p className="font-mono text-[10px] text-slate-400 dark:text-slate-500 break-all">
          Série: {meta.serialNumber}
        </p>
      )}
    </div>
  );
}

export interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  cidade?: string;
  uf?: string;
  email?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string | null;
  bairro?: string;
  cep?: string;
  codigo_municipio?: string | null;
  crt?: string | null;
  cnae?: string | null;
  nfe_serie?: string | null;
  nfe_ambiente?: number | null;
  nfe_proximo_numero?: number | null;
  total_filiais?: number;
  ativo?: number;
  created_at: string;
  a1_cert_uploaded_at?: string | null;
  a1_cert_meta?: string | null;
}

export interface Filial {
  id: string;
  nome: string;
  cnpj?: string;
  uf?: string;
  cidade?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string | null;
  bairro?: string;
  cep?: string;
  codigo_municipio?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  ativa: number;
  empresa_id: string;
  empresa_nome?: string;
  created_at?: string;
  a1_cert_uploaded_at?: string | null;
  a1_cert_meta?: string | null;
}

export function normalizeEmpresaRow(row: unknown): Empresa {
  const r = row as Record<string, unknown> & Partial<Empresa>;
  const up = r.a1_cert_uploaded_at ?? r.a1CertUploadedAt;
  const meta = r.a1_cert_meta ?? r.a1CertMeta;
  return {
    ...(r as Empresa),
    ativo: r.ativo === 0 ? 0 : 1,
    a1_cert_uploaded_at: up != null && String(up) !== '' ? String(up) : null,
    a1_cert_meta:
      meta == null || meta === ''
        ? null
        : typeof meta === 'string'
          ? meta
          : JSON.stringify(meta),
  };
}

export function normalizeFilialRow(row: unknown): Filial {
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

export type EmpresaForm = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  email: string;
  telefone: string;
  uf: string;
  cidade: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  codigoMunicipio: string;
  crt: string;
  cnae: string;
  nfeSerie: string;
  nfeAmbiente: string;
  nfeProximoNumero: string;
};

export type FilialForm = {
  nome: string;
  cnpj: string;
  uf: string;
  cidade: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  codigoMunicipio: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  ativa: boolean;
};

export const emptyEmpresa = (): EmpresaForm => ({
  razaoSocial: '',
  nomeFantasia: '',
  cnpj: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  email: '',
  telefone: '',
  uf: 'SC',
  cidade: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cep: '',
  codigoMunicipio: '',
  crt: '1',
  cnae: '',
  nfeSerie: '1',
  nfeAmbiente: '2',
  nfeProximoNumero: '1',
});

export const emptyFilial = (): FilialForm => ({
  nome: '',
  cnpj: '',
  uf: 'SC',
  cidade: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cep: '',
  codigoMunicipio: '',
  inscricaoEstadual: '',
  inscricaoMunicipal: '',
  ativa: true,
});

export const FIELD_CLS =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  maxLen,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  maxLen?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLen}
        className={FIELD_CLS}
      />
    </div>
  );
}

export function MaskedField({
  label,
  required,
  ...props
}: { label: string; required?: boolean } & ComponentProps<typeof MaskedInput>) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <MaskedInput className={FIELD_CLS} {...props} />
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function empresaToForm(row: Empresa): EmpresaForm {
  return {
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia ?? '',
    cnpj: row.cnpj ?? '',
    inscricaoEstadual: row.inscricao_estadual ?? '',
    inscricaoMunicipal: row.inscricao_municipal ?? '',
    email: row.email ?? '',
    telefone: row.telefone ?? '',
    uf: row.uf ?? 'SC',
    cidade: row.cidade ?? '',
    logradouro: row.logradouro ?? '',
    numero: row.numero ?? '',
    complemento: row.complemento ?? '',
    bairro: row.bairro ?? '',
    cep: row.cep ?? '',
    codigoMunicipio: row.codigo_municipio ?? '',
    crt: row.crt ?? '1',
    cnae: row.cnae ?? '',
    nfeSerie: row.nfe_serie ?? '1',
    nfeAmbiente: row.nfe_ambiente != null ? String(row.nfe_ambiente) : '2',
    nfeProximoNumero: row.nfe_proximo_numero != null ? String(row.nfe_proximo_numero) : '1',
  };
}

export function filialToForm(row: Filial): FilialForm {
  return {
    nome: row.nome,
    cnpj: row.cnpj ?? '',
    uf: row.uf ?? 'SC',
    cidade: row.cidade ?? '',
    logradouro: row.logradouro ?? '',
    numero: row.numero ?? '',
    complemento: row.complemento ?? '',
    bairro: row.bairro ?? '',
    cep: row.cep ?? '',
    codigoMunicipio: row.codigo_municipio ?? '',
    inscricaoEstadual: row.inscricao_estadual ?? '',
    inscricaoMunicipal: row.inscricao_municipal ?? '',
    ativa: row.ativa === 1,
  };
}
