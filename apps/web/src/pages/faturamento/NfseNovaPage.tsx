import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PessoaBusca } from '../../components/PessoaBusca';
import api from '../../services/api';
import { notasService } from '../../services/faturamentoService';
import { fmtBRL } from '../../utils/format';
import CurrencyInput from '../../components/common/CurrencyInput';
import { useErrorNotification } from '../../context/ErrorNotificationContext';

interface Servico {
  id: string;
  descricao: string;
  preco: number;
}

const FIELD =
  'w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500';

/**
 * Página fixa de criação de NFS-e (rascunho) — mesmo padrão da nova NF-e assistida
 * (não usa modal flutuante).
 */
export default function NfseNovaPage() {
  const navigate = useNavigate();
  const { reportError, notify } = useErrorNotification();
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [destinatarioId, setDestinatarioId] = useState('');
  const [destinatarioNome, setDestinatarioNome] = useState('');
  const [form, setForm] = useState({
    descricaoServico: '',
    codigoServico: '',
    aliquotaIss: 2,
    observacoes: '',
    desconto: 0,
    valor: 0,
  });

  useEffect(() => {
    api
      .get('/tenant/cadastros/servicos')
      .then((r) => setServicos(r.data.servicos ?? []))
      .catch(() => {});
  }, []);

  const fillFromServico = (id: string) => {
    const s = servicos.find((x) => x.id === id);
    if (s) setForm((f) => ({ ...f, descricaoServico: s.descricao, valor: s.preco ?? 0 }));
  };

  const valorIss = form.valor * (form.aliquotaIss / 100);
  const totalFinal = form.valor - form.desconto;

  const handleSave = async () => {
    if (!form.descricaoServico.trim()) {
      setError('Informe a descrição do serviço.');
      return;
    }
    if (form.valor <= 0) {
      setError('Informe o valor do serviço.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await notasService.create({
        tipo: 'nfse',
        destinatarioId: destinatarioId || undefined,
        descricaoServico: form.descricaoServico,
        codigoServico: form.codigoServico || undefined,
        aliquotaIss: form.aliquotaIss,
        observacoes: form.observacoes || undefined,
        desconto: form.desconto,
        itens: [
          {
            descricao: form.descricaoServico,
            quantidade: 1,
            valorUnitario: form.valor,
            desconto: form.desconto,
            unidade: 'SV',
          },
        ],
      });
      notify('Rascunho de NFS-e criado.', 'success');
      navigate(`/faturamento/nfse/${created.id}`);
    } catch (err) {
      reportError('Erro ao salvar NFS-e.', err, 'Faturamento NFS-e');
      setError(
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
          'Erro ao salvar.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div>
        <Link
          to="/faturamento/nfse"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar à lista de NFS-e
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          Nova NFS-e
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Preencha o rascunho e salve. Em seguida: Gerar XML/DPS → Transmitir prefeitura → Faturar no
          ERP.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Tomador (cliente)
          </label>
          <PessoaBusca
            value={destinatarioId}
            displayValue={destinatarioNome}
            onChange={(id, nome) => {
              setDestinatarioId(id);
              setDestinatarioNome(nome);
            }}
            placeholder="Buscar tomador por nome ou CPF/CNPJ..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Serviço cadastrado (opcional)
          </label>
          <select
            onChange={(e) => fillFromServico(e.target.value)}
            defaultValue=""
            className={FIELD}
          >
            <option value="">Selecionar serviço para preencher automaticamente...</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.descricao}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Descrição do Serviço <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.descricaoServico}
            onChange={(e) => setForm((f) => ({ ...f, descricaoServico: e.target.value }))}
            rows={4}
            placeholder="Descrição detalhada do serviço prestado..."
            className={`${FIELD} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Cód. serviço (municipal SP / LC 116)
            </label>
            <input
              value={form.codigoServico}
              onChange={(e) => setForm((f) => ({ ...f, codigoServico: e.target.value }))}
              placeholder="Ex: 02800 (SP) ou 01.01 (nacional)"
              className={`${FIELD} font-mono`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Alíquota ISS (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.aliquotaIss}
              onChange={(e) =>
                setForm((f) => ({ ...f, aliquotaIss: parseFloat(e.target.value) || 0 }))
              }
              className={FIELD}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Valor do Serviço (R$) <span className="text-red-500">*</span>
            </label>
            <CurrencyInput
              value={form.valor}
              onChange={(v) => setForm((f) => ({ ...f, valor: v }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Desconto (R$)
            </label>
            <CurrencyInput
              value={form.desconto}
              onChange={(v) => setForm((f) => ({ ...f, desconto: v }))}
            />
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>Valor do serviço:</span>
            <span>{fmtBRL(form.valor)}</span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>ISS ({form.aliquotaIss}%):</span>
            <span className="text-amber-600 dark:text-amber-400">{fmtBRL(valorIss)}</span>
          </div>
          {form.desconto > 0 && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Desconto:</span>
              <span>-{fmtBRL(form.desconto)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5">
            <span>Total:</span>
            <span className="text-brand-600 dark:text-brand-400">{fmtBRL(totalFinal)}</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Observações
          </label>
          <input
            value={form.observacoes}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            placeholder="Informações adicionais..."
            className={FIELD}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/faturamento/nfse"
          className="px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Cancelar
        </Link>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="px-4 py-2.5 text-sm bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar rascunho e abrir'}
        </button>
        <Link
          to="/configuracoes/nfse"
          className="px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          Configurar emissão
        </Link>
      </div>
    </div>
  );
}
