import { useCallback, useEffect, useState } from 'react';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatApiError } from '../../utils/helpers';
import {
  formasPagamentoService,
  type FormaPagamento,
  type FormaPagamentoForm,
  type FormaPagamentoTipo,
} from '../../services/cadastros/formasPagamento';

const TIPO_LABEL: Record<FormaPagamentoTipo, string> = {
  dinheiro: 'Dinheiro',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  boleto: 'Boleto',
  pix: 'PIX',
  transferencia: 'Transferência',
  cheque: 'Cheque',
  outro: 'Outro',
};

interface FormState {
  codigo: string;
  nome: string;
  tipo: FormaPagamentoTipo;
  maxParcelas: string;
  taxaPercentual: string;
  prazoRecebimentoDias: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = {
  codigo: '', nome: '', tipo: 'dinheiro', maxParcelas: '', taxaPercentual: '', prazoRecebimentoDias: '', ativo: true,
};

function formFromForma(f: FormaPagamento): FormState {
  return {
    codigo: f.codigo,
    nome: f.nome,
    tipo: f.tipo,
    maxParcelas: f.max_parcelas != null ? String(f.max_parcelas) : '',
    taxaPercentual: f.taxa_percentual != null ? String(f.taxa_percentual) : '',
    prazoRecebimentoDias: f.prazo_recebimento_dias != null ? String(f.prazo_recebimento_dias) : '',
    ativo: f.ativo === 1,
  };
}

export default function FormasPagamentoPage() {
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FormaPagamento | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<FormaPagamento | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await formasPagamentoService.list({ search: appliedSearch || undefined, limit: 200 });
      setFormas(r.formas);
      setTotal(r.total);
    } catch (e) {
      setError(formatApiError(e, 'Erro ao carregar formas de pagamento.'));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => { void carregar(); }, [carregar]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (f: FormaPagamento) => {
    setEditing(f);
    setForm(formFromForma(f));
    setFormError('');
    setModalOpen(true);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setFormError('');
    if (!form.codigo.trim() || !form.nome.trim()) {
      setFormError('Preencha o código e o nome.');
      return;
    }

    const maxParcelas = form.maxParcelas.trim() ? Number(form.maxParcelas) : undefined;
    const taxaPercentual = form.taxaPercentual.trim() ? Number(form.taxaPercentual.replace(',', '.')) : undefined;
    const prazoRecebimentoDias = form.prazoRecebimentoDias.trim() ? Number(form.prazoRecebimentoDias) : undefined;

    if (maxParcelas !== undefined && (!Number.isInteger(maxParcelas) || maxParcelas < 1)) {
      setFormError('Informe um número de parcelas válido.');
      return;
    }
    if (taxaPercentual !== undefined && Number.isNaN(taxaPercentual)) {
      setFormError('Informe uma taxa percentual válida.');
      return;
    }
    if (prazoRecebimentoDias !== undefined && (!Number.isInteger(prazoRecebimentoDias) || prazoRecebimentoDias < 0)) {
      setFormError('Informe um prazo de recebimento válido (em dias).');
      return;
    }

    const input: FormaPagamentoForm = {
      codigo: form.codigo.trim(),
      nome: form.nome.trim(),
      tipo: form.tipo,
      maxParcelas,
      taxaPercentual,
      prazoRecebimentoDias,
      ativo: form.ativo,
    };

    setSaving(true);
    try {
      if (editing) {
        await formasPagamentoService.update(editing.id, input);
        setSuccess('Forma de pagamento atualizada.');
      } else {
        await formasPagamentoService.create(input);
        setSuccess('Forma de pagamento criada.');
      }
      setModalOpen(false);
      await carregar();
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao salvar forma de pagamento.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await formasPagamentoService.delete(deleting.id);
      setSuccess('Forma de pagamento removida.');
      setDeleting(null);
      await carregar();
    } catch (e) {
      setError(formatApiError(e, 'Erro ao remover forma de pagamento.'));
      setDeleting(null);
    }
  };

  return (
    <BaseListPage
      title="Formas de Pagamento"
      description="Meios de recebimento e pagamento aceitos — dinheiro, cartão, boleto, PIX, etc."
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('formas-pagamento', [
        { label: 'Código', value: (r: FormaPagamento) => r.codigo },
        { label: 'Nome', value: (r: FormaPagamento) => r.nome },
        { label: 'Tipo', value: (r: FormaPagamento) => TIPO_LABEL[r.tipo] ?? r.tipo },
        { label: 'Máx. parcelas', value: (r: FormaPagamento) => r.max_parcelas },
        { label: 'Taxa (%)', value: (r: FormaPagamento) => r.taxa_percentual },
        { label: 'Prazo recebimento (dias)', value: (r: FormaPagamento) => r.prazo_recebimento_dias },
        { label: 'Ativo', value: (r: FormaPagamento) => (r.ativo === 1 ? 'Sim' : 'Não') },
      ], formas)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <form
          onSubmit={e => { e.preventDefault(); setAppliedSearch(searchInput.trim()); }}
          className="flex gap-2 flex-1"
        >
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Buscar em formas de pagamento…"
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button type="submit" className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Buscar
          </button>
        </form>
        <Button variant="primary" onClick={openCreate}>+ Novo</Button>
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <LoadingSpinner fullScreen text="Carregando formas de pagamento..." />
      ) : formas.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma forma de pagamento cadastrada</p>
          <Button variant="primary" size="sm" onClick={openCreate} className="mt-4">Criar primeira forma de pagamento</Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Código</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nome</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Máx. parcelas</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Taxa</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Situação</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {formas.map(f => (
                <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-sm font-mono text-slate-600 dark:text-slate-300">{f.codigo}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100">{f.nome}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{TIPO_LABEL[f.tipo] ?? f.tipo}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-slate-600 dark:text-slate-300 font-mono">{f.max_parcelas ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-right text-slate-600 dark:text-slate-300 font-mono">{f.taxa_percentual != null ? `${f.taxa_percentual}%` : '—'}</td>
                  <td className="px-4 py-2.5 text-sm">
                    {f.ativo === 1 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Ativo</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(f)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleting(f)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors" title="Excluir">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800">
            {total} registro(s)
          </div>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Editar forma de pagamento — ${editing.nome}` : 'Nova forma de pagamento'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Salvar alterações' : 'Criar forma de pagamento'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error" message={formError} className="mb-0" />}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Código"
              name="forma-codigo"
              value={form.codigo}
              onChange={e => set('codigo', e.target.value)}
              required
            />
            <Select
              label="Tipo"
              name="forma-tipo"
              value={form.tipo}
              onChange={e => set('tipo', e.target.value as FormaPagamentoTipo)}
              options={Object.entries(TIPO_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
          <Input
            label="Nome"
            name="forma-nome"
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Máx. parcelas"
              name="forma-max-parcelas"
              value={form.maxParcelas}
              onChange={e => set('maxParcelas', e.target.value)}
              placeholder="ex: 12"
            />
            <Input
              label="Taxa (%)"
              name="forma-taxa"
              value={form.taxaPercentual}
              onChange={e => set('taxaPercentual', e.target.value)}
              placeholder="ex: 2.5"
            />
            <Input
              label="Prazo recebimento (dias)"
              name="forma-prazo"
              value={form.prazoRecebimentoDias}
              onChange={e => set('prazoRecebimentoDias', e.target.value)}
              placeholder="ex: 30"
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={e => set('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Forma de pagamento ativa</span>
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover forma de pagamento"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover a forma de pagamento <strong>{deleting?.nome}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </BaseListPage>
  );
}
