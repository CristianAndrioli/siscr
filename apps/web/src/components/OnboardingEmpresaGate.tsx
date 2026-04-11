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
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [uf, setUf] = useState('');
  const [cidade, setCidade] = useState('');

  const [addFilial, setAddFilial] = useState(false);
  const [filialNome, setFilialNome] = useState('');
  const [filialCnpj, setFilialCnpj] = useState('');
  const [filialUf, setFilialUf] = useState('');
  const [filialCidade, setFilialCidade] = useState('');

  const [addCert, setAddCert] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);
  const [certPassword, setCertPassword] = useState('');

  const cnpjDigits = onlyDigits(cnpj);
  const canStep1 = razaoSocial.trim().length >= 2 && cnpjDigits.length === 14;

  const submit = async () => {
    setError('');
    if (!canStep1) {
      setError('Informe razão social e CNPJ com 14 dígitos.');
      return;
    }
    if (addFilial && filialNome.trim().length < 2) {
      setError('Nome da filial deve ter pelo menos 2 caracteres, ou desmarque “Adicionar filial”.');
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
      const { data: created } = await api.post<{ id: string }>('/tenant/info/empresas', {
        razaoSocial: razaoSocial.trim(),
        nomeFantasia: nomeFantasia.trim() || undefined,
        cnpj: cnpjDigits,
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        uf: uf.trim().length === 2 ? uf.trim().toUpperCase() : undefined,
        cidade: cidade.trim() || undefined,
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-4 overflow-y-auto pointer-events-auto">
      <div className="my-auto w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Bem-vindo</p>
          <h2 className="font-display mt-1 text-xl font-bold text-white">Cadastre a empresa matriz</h2>
          <p className="mt-2 text-sm text-slate-400">
            Para usar o ERP, é obrigatório cadastrar pelo menos uma empresa (CNPJ). Filial e certificado digital A1 são opcionais.
          </p>
        </div>

        <div className="max-h-[min(70vh,560px)] overflow-y-auto px-6 py-5 space-y-5">
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
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">UF</span>
                  <input
                    maxLength={2}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white uppercase focus:border-brand-500 focus:outline-none"
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Cidade</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                  />
                </label>
              </div>
            </>
          )}

          {step === 2 && (
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

          {step === 3 && (
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
            <span className="text-xs text-slate-500">Etapa {step} de 3</span>
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
            {step < 3 ? (
              <button
                type="button"
                disabled={saving || (step === 1 && !canStep1)}
                onClick={() => {
                  setError('');
                  if (step === 1 && !canStep1) {
                    setError('Preencha razão social e CNPJ com 14 dígitos.');
                    return;
                  }
                  setStep((s) => s + 1);
                }}
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
