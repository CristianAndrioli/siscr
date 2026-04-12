import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../services/api';
import { authService } from '../services/auth';
import MaskedInput from './common/MaskedInput';

type OnboardingStatus = {
  needsEmpresaOnboarding: boolean;
  empresaCount: number;
  certificateStorageReady: boolean;
};

type GateMode = 'loading' | 'hidden' | 'admin_wizard' | 'wait_admin' | 'load_error';

const onlyDigits = (s: string) => s.replace(/\D/g, '');

export default function OnboardingEmpresaGate() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<GateMode>('loading');
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loadErrorMsg, setLoadErrorMsg] = useState('');

  const doLogout = useCallback(async () => {
    await authService.logout();
    navigate('/login');
  }, [navigate]);

  const load = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setMode('hidden');
      return;
    }
    try {
      const { data } = await api.get<OnboardingStatus>('/tenant/info/onboarding');
      setStatus(data);
      if (!data.needsEmpresaOnboarding) {
        setMode('hidden');
        return;
      }
      const u = authService.getLocalUser() as { role?: string } | null;
      if (u?.role === 'admin') setMode('admin_wizard');
      else setMode('wait_admin');
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 401) {
        setMode('hidden');
        return;
      }
      const msg = axios.isAxiosError(e)
        ? (e.response?.data as { error?: string })?.error
        : undefined;
      setLoadErrorMsg(msg || 'Não foi possível verificar o cadastro da empresa. Tente de novo ou saia e entre novamente.');
      setMode('load_error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (mode === 'hidden') return null;

  if (mode === 'loading') {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm pointer-events-auto"
        aria-busy="true"
        role="dialog"
        aria-label="Verificando configuração"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Verificando configuração da empresa…</p>
        </div>
      </div>
    );
  }

  if (mode === 'load_error') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 pointer-events-auto">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center shadow-2xl">
          <h2 className="font-display text-xl font-bold text-white">Não foi possível continuar</h2>
          <p className="mt-3 text-sm text-slate-400">{loadErrorMsg}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => {
                setMode('loading');
                load();
              }}
              className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={doLogout}
              className="rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
            >
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'wait_admin') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 pointer-events-auto">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/15 text-2xl">⏳</div>
          <h2 className="font-display text-xl font-bold text-white">Configuração pendente</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            O administrador ainda precisa cadastrar a empresa matriz (CNPJ) neste ambiente. Você poderá usar o sistema assim que isso for concluído.
          </p>
          <p className="mt-4 text-xs text-slate-500">
            Em caso de dúvida, entre em contato com quem criou a conta.
          </p>
          <button
            type="button"
            onClick={doLogout}
            className="mt-6 w-full rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Sair da conta
          </button>
        </div>
      </div>
    );
  }

  return (
    <OnboardingWizard
      certificateStorageReady={status?.certificateStorageReady ?? false}
      onLogout={doLogout}
      onFinished={() => {
        setMode('loading');
        load();
      }}
    />
  );
}

const TOTAL_STEPS = 5;

function OnboardingWizard({
  certificateStorageReady,
  onLogout,
  onFinished,
}: {
  certificateStorageReady: boolean;
  onLogout: () => void | Promise<void>;
  onFinished: () => void;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [inscricaoEstadual, setInscricaoEstadual] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');

  const [cep, setCep] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [codigoMunicipio, setCodigoMunicipio] = useState('');

  const [crt, setCrt] = useState<'1' | '2' | '3'>('1');
  const [cnae, setCnae] = useState('');
  const [nfeSerie, setNfeSerie] = useState('1');
  const [nfeAmbiente, setNfeAmbiente] = useState<1 | 2>(2);
  const [nfeProximoNumero, setNfeProximoNumero] = useState('1');

  const [addFilial, setAddFilial] = useState(false);
  const [filialNome, setFilialNome] = useState('');
  const [filialCnpj, setFilialCnpj] = useState('');
  const [filialUf, setFilialUf] = useState('');
  const [filialCidade, setFilialCidade] = useState('');

  const [addCert, setAddCert] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');

  const cnpjDigits = onlyDigits(cnpj);
  const cepDigits = onlyDigits(cep);
  const codMunDigits = onlyDigits(codigoMunicipio);
  const emailTrim = email.trim();
  const emailOk = !emailTrim || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim);
  const canStep1 = razaoSocial.trim().length >= 2 && cnpjDigits.length === 14 && emailOk;
  const ufOk = /^[A-Za-z]{2}$/.test(uf.trim());
  const canStep2 =
    logradouro.trim().length >= 1 &&
    numero.trim().length >= 1 &&
    bairro.trim().length >= 1 &&
    cidade.trim().length >= 1 &&
    ufOk &&
    cepDigits.length === 8 &&
    codMunDigits.length === 7;

  const validateStep = (s: number): string | null => {
    if (s === 1) {
      if (!canStep1) {
        if (!emailOk) return 'Informe um e-mail válido ou deixe em branco.';
        return 'Preencha razão social e CNPJ com 14 dígitos.';
      }
      return null;
    }
    if (s === 2) {
      if (!canStep2) {
        return 'Preencha o endereço fiscal: logradouro, número, bairro, cidade, UF (2 letras), CEP completo e código IBGE do município (7 dígitos).';
      }
      return null;
    }
    if (s === 3) {
      const serie = nfeSerie.trim();
      const prox = parseInt(nfeProximoNumero, 10);
      if (!serie || serie.length > 3) return 'Informe a série da NF-e (até 3 caracteres).';
      if (!Number.isFinite(prox) || prox < 1) return 'Informe o próximo número da NF-e (mínimo 1).';
      return null;
    }
    if (s === 4) {
      if (addFilial && filialNome.trim().length < 2) {
        return 'Nome da filial deve ter pelo menos 2 caracteres, ou desmarque “Adicionar filial”.';
      }
      return null;
    }
    return null;
  };

  const goNext = () => {
    setError('');
    const msg = validateStep(step);
    if (msg) {
      setError(msg);
      return;
    }
    setStep((x) => Math.min(x + 1, TOTAL_STEPS));
  };

  const submit = async () => {
    setError('');
    for (let s = 1; s <= 4; s++) {
      const msg = validateStep(s);
      if (msg) {
        setError(msg);
        setStep(s);
        return;
      }
    }
    if (addFilial && filialNome.trim().length < 2) {
      setError('Nome da filial deve ter pelo menos 2 caracteres, ou desmarque “Adicionar filial”.');
      setStep(4);
      return;
    }
    if (addCert && certificateStorageReady) {
      if (!certFile) {
        setError('Selecione o arquivo .pfx ou .p12, ou desmarque o certificado.');
        return;
      }
      if (!certPassword) {
        setError('Informe a senha do certificado.');
        return;
      }
    }

    setSaving(true);
    try {
      const proxNfe = parseInt(nfeProximoNumero, 10);
      const { data: created } = await api.post<{ id: string }>('/tenant/info/empresas', {
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim() || undefined,
        cnpj: cnpjDigits,
        inscricaoEstadual: inscricaoEstadual.trim() || undefined,
        email: emailTrim || undefined,
        telefone: telefone.trim() || undefined,
        logradouro: logradouro.trim(),
        numero: numero.trim(),
        complemento: complemento.trim() || undefined,
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        uf: uf.trim().toUpperCase(),
        cep: cepDigits,
        codigoMunicipio: codMunDigits,
        crt,
        cnae: cnae.trim() || undefined,
        nfeSerie: nfeSerie.trim(),
        nfeAmbiente,
        nfeProximoNumero: Number.isFinite(proxNfe) && proxNfe >= 1 ? proxNfe : 1,
      });
      const empresaId = created.id;

      if (addFilial && filialNome.trim().length >= 2) {
        const fc = onlyDigits(filialCnpj);
        await api.post(`/tenant/info/empresas/${empresaId}/filiais`, {
          nome: filialNome.trim(),
          cnpj: fc.length === 14 ? fc : undefined,
          uf: filialUf.trim().length === 2 ? filialUf.trim().toUpperCase() : undefined,
          cidade: filialCidade.trim() || undefined,
        });
      }

      if (addCert && certificateStorageReady && certFile && certPassword) {
        const fd = new FormData();
        fd.append('file', certFile);
        fd.append('password', certPassword);
        try {
          await api.post(`/tenant/info/empresas/${empresaId}/certificado-a1`, fd);
        } catch (e: unknown) {
          const ax = e as { response?: { data?: { error?: string; code?: string } } };
          const msg = ax.response?.data?.error || 'Não foi possível enviar o certificado.';
          setError(`${msg} A empresa já foi criada; você pode enviar o certificado depois em Configurações.`);
          setSaving(false);
          onFinished();
          return;
        }
      }

      onFinished();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const stepTitle: Record<number, { title: string; hint: string }> = {
    1: {
      title: 'Identificação da empresa',
      hint: 'Dados cadastrais conforme a Receita Federal. A inscrição estadual é usada na NF-e.',
    },
    2: {
      title: 'Endereço fiscal',
      hint: 'Endereço do estabelecimento matriz. O código IBGE do município (7 dígitos) é obrigatório no XML da NF-e.',
    },
    3: {
      title: 'Perfil da NF-e',
      hint: 'Regime tributário (CRT), ambiente e numeração inicial. Em homologação as notas não têm valor fiscal.',
    },
    4: {
      title: 'Filial (opcional)',
      hint: 'Se a operação usar outro CNPJ ou ponto, cadastre uma filial. Pode fazer depois em Configurações.',
    },
    5: {
      title: 'Certificado digital A1',
      hint: 'O certificado é necessário para assinar a NF-e. Você pode enviar agora ou configurar depois.',
    },
  };

  const head = stepTitle[step] ?? stepTitle[1];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto pointer-events-auto">
      <div className="my-auto w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Configuração inicial</p>
          <h2 className="font-display mt-1 text-xl font-bold text-white">{head.title}</h2>
          <p className="mt-2 text-sm text-slate-400">{head.hint}</p>
        </div>

        <div className="max-h-[min(72vh,620px)] overflow-y-auto px-6 py-5 space-y-5">
          {step === 1 && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Razão social *</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Nome empresarial conforme Receita"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Nome fantasia</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
                  value={nomeFantasia}
                  onChange={(e) => setNomeFantasia(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">CNPJ *</span>
                <MaskedInput
                  mask="cnpj"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none font-mono"
                  value={cnpj}
                  onChange={setCnpj}
                  placeholder="00.000.000/0000-00"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Inscrição estadual (IE)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
                  value={inscricaoEstadual}
                  onChange={(e) => setInscricaoEstadual(e.target.value)}
                  placeholder="Número da IE ou ISENTO, se aplicável"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">E-mail</span>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Telefone</span>
                  <MaskedInput
                    mask="phone"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    value={telefone}
                    onChange={setTelefone}
                    placeholder="(48) 99999-9999"
                  />
                </label>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">CEP *</span>
                  <MaskedInput
                    mask="cep"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                    value={cep}
                    onChange={setCep}
                    placeholder="00000-000"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Código IBGE do município *</span>
                  <input
                    inputMode="numeric"
                    maxLength={7}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
                    value={codigoMunicipio}
                    onChange={(e) => setCodigoMunicipio(onlyDigits(e.target.value).slice(0, 7))}
                    placeholder="7 dígitos"
                  />
                </label>
              </div>
              <p className="text-xs text-slate-500 -mt-2">
                Consulte o código do município na tabela do IBGE (código de 7 dígitos do local da sede).
              </p>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Logradouro *</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  value={logradouro}
                  onChange={(e) => setLogradouro(e.target.value)}
                  placeholder="Rua, avenida…"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Número *</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Complemento</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    value={complemento}
                    onChange={(e) => setComplemento(e.target.value)}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Bairro *</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Cidade *</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">UF *</span>
                  <input
                    maxLength={2}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white uppercase focus:border-brand-500 focus:outline-none"
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                  />
                </label>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">CRT (regime tributário) *</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  value={crt}
                  onChange={(e) => setCrt(e.target.value as '1' | '2' | '3')}
                >
                  <option value="1">1 — Simples Nacional</option>
                  <option value="2">2 — Simples Nacional (excesso de sublimite)</option>
                  <option value="3">3 — Regime normal (Lucro Presumido / Real)</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">Ambiente da NF-e *</span>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  value={nfeAmbiente}
                  onChange={(e) => setNfeAmbiente(Number(e.target.value) as 1 | 2)}
                >
                  <option value={2}>Homologação (testes, sem valor fiscal)</option>
                  <option value={1}>Produção (notas válidas)</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Série *</span>
                  <input
                    maxLength={3}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                    value={nfeSerie}
                    onChange={(e) => setNfeSerie(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Próximo número *</span>
                  <input
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                    value={nfeProximoNumero}
                    onChange={(e) => setNfeProximoNumero(e.target.value.replace(/\D/g, ''))}
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-medium text-slate-400">CNAE fiscal (opcional)</span>
                <input
                  maxLength={10}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:border-brand-500 focus:outline-none"
                  value={cnae}
                  onChange={(e) => setCnae(e.target.value)}
                  placeholder="Principal da empresa, se souber"
                />
              </label>
            </>
          )}

          {step === 4 && (
            <>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-slate-600"
                  checked={addFilial}
                  onChange={(e) => setAddFilial(e.target.checked)}
                />
                <div>
                  <span className="text-sm font-semibold text-white">Adicionar uma filial agora</span>
                  <p className="mt-1 text-xs text-slate-500">Opcional. Você pode cadastrar depois em Configurações.</p>
                </div>
              </label>

              {addFilial && (
                <div className="space-y-3 rounded-xl border border-slate-800 p-4">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-400">Nome da filial *</span>
                    <input
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                      value={filialNome}
                      onChange={(e) => setFilialNome(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-400">CNPJ da filial (opcional)</span>
                    <MaskedInput
                      mask="cnpj"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                      value={filialCnpj}
                      onChange={setFilialCnpj}
                      placeholder="00.000.000/0000-00"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-slate-400">UF</span>
                      <input
                        maxLength={2}
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white uppercase focus:border-brand-500 focus:outline-none"
                        value={filialUf}
                        onChange={(e) => setFilialUf(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-400">Cidade</span>
                      <input
                        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                        value={filialCidade}
                        onChange={(e) => setFilialCidade(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-slate-600"
                  checked={addCert}
                  onChange={(e) => setAddCert(e.target.checked)}
                />
                <div>
                  <span className="text-sm font-semibold text-white">Enviar certificado A1 (.pfx / .p12)</span>
                  <p className="mt-1 text-xs text-slate-500">
                    Opcional. Pode enviar agora ou configurar depois no local adequado, para uso na emissão de NF-e quando o recurso estiver ativo.
                  </p>
                </div>
              </label>

              {!certificateStorageReady && (
                <p className="rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
                  O envio do certificado ainda não está disponível aqui. Pule esta etapa — você poderá configurá-lo depois no local adequado (por exemplo, nas configurações da empresa).
                </p>
              )}

              {addCert && certificateStorageReady && (
                <div className="space-y-3 rounded-xl border border-slate-800 p-4">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-400">Arquivo .pfx ou .p12</span>
                    <input
                      type="file"
                      accept=".pfx,.p12"
                      className="mt-1 w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                      onChange={(e) => setCertFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-400">Senha do certificado</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                      value={certPassword}
                      onChange={(e) => setCertPassword(e.target.value)}
                    />
                  </label>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="rounded-lg border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-6 py-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">
              Etapa {step} de {TOTAL_STEPS}
            </span>
            <button
              type="button"
              onClick={() => onLogout()}
              className="text-left text-xs text-slate-500 underline decoration-slate-600 hover:text-slate-300"
            >
              Sair da conta
            </button>
          </div>
          <div className="flex gap-2">
            {step > 1 && (
              <button
                type="button"
                disabled={saving}
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Voltar
              </button>
            )}
            {step < TOTAL_STEPS ? (
              <button
                type="button"
                disabled={saving}
                onClick={goNext}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={submit}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-40"
              >
                {saving ? 'Salvando…' : 'Concluir'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
