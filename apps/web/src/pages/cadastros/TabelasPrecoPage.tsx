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
  tabelasPrecoService,
  type TabelaPreco,
  type TabelaPrecoForm,
  type TabelaPrecoTipoAjuste,
} from '../../services/cadastros/tabelasPreco';

const TIPO_AJUSTE_LABEL: Record<TabelaPrecoTipoAjuste, string> = {
  percentual: 'Percentual (%)',
  fixo: 'Valor fixo (R$)',
};

interface FormState {
  nome: string;
  tipoAjuste: TabelaPrecoTipoAjuste;
  valorAjuste: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  ativo: boolean;
}

const EMPTY_FORM: FormState = {
  nome: '', tipoAjuste: 'percentual', valorAjuste: '', vigenciaInicio: '', vigenciaFim: '', ativo: true,
};

function formFromTabela(t: TabelaPreco): FormState {
  return {
    nome: t.nome,
    tipoAjuste: t.tipo_ajuste,
    valorAjuste: t.valor_ajuste != null ? String(t.valor_ajuste) : '',
    vigenciaInicio: t.vigencia_inicio ? t.vigencia_inicio.slice(0, 10) : '',
    vigenciaFim: t.vigencia_fim ? t.vigencia_fim.slice(0, 10) : '',
    ativo: t.ativo === 1,
  };
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString('pt-BR');
}

export default function TabelasPrecoPage() {
  const [tabelas, setTabelas] = useState<TabelaPreco[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TabelaPreco | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<TabelaPreco | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await tabelasPrecoService.list({ search: appliedSearch || undefined, limit: 200 });
      setTabelas(r.tabelas);
      setTotal(r.total);
    } catch (e) {
      setError(formatApiError(e, 'Erro ao carregar tabelas de preço.'));
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

  const openEdit = (t: TabelaPreco) => {
    setEditing(t);
    setForm(formFromTabela(t));
    setFormError('');
    setModalOpen(true);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    setFormError('');
    if (!form.nome.trim()) {
      setFormError('Preencha o nome da tabela.');
      return;
    }
    const valor = form.valorAjuste.trim() ? Number(form.valorAjuste.replace(',', '.')) : undefined;
    if (valor !== undefined && Number.isNaN(valor)) {
      setFormError('Informe um valor de ajuste numérico válido.');
      return;
    }
    if (form.vigenciaInicio && form.vigenciaFim && form.vigenciaFim < form.vigenciaInicio) {
      setFormError('A vigência final não pode ser anterior à vigência inicial.');
      return;
    }

    const input: TabelaPrecoForm = {
      nome: form.nome.trim(),
      tipoAjuste: form.tipoAjuste,
      valorAjuste: valor,
      vigenciaInicio: form.vigenciaInicio || null,
      vigenciaFim: form.vigenciaFim || null,
      ativo: form.ativo,
    };

    setSaving(true);
    try {
      if (editing) {
        await tabelasPrecoService.update(editing.id, input);
        setSuccess('Tabela de preço atualizada.');
      } else {
        await tabelasPrecoService.create(input);
        setSuccess('Tabela de preço criada.');
      }
      setModalOpen(false);
      await carregar();
    } catch (e) {
      setFormError(formatApiError(e, 'Erro ao salvar tabela de preço.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await tabelasPrecoService.delete(deleting.id);
      setSuccess('Tabela de preço removida.');
      setDeleting(null);
      await carregar();
    } catch (e) {
      setError(formatApiError(e, 'Erro ao remover tabela de preço.'));
      setDeleting(null);
    }
  };

  return (
    <BaseListPage
      title="Tabelas de Preço"
      description="Cabeçalho de tabelas de preço — percentuais ou valores fixos de ajuste sobre o preço base"
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('tabelas-preco', [
        { label: 'Nome', value: (r: TabelaPreco) => r.nome },
        { label: 'Tipo de ajuste', value: (r: TabelaPreco) => TIPO_AJUSTE_LABEL[r.tipo_ajuste] ?? r.tipo_ajuste },
        { label: 'Valor de ajuste', value: (r: TabelaPreco) => r.valor_ajuste },
        { label: 'Vigência início', value: (r: TabelaPreco) => r.vigencia_inicio },
        { label: 'Vigência fim', value: (r: TabelaPreco) => r.vigencia_fim },
        { label: 'Itens', value: (r: TabelaPreco) => r.num_itens },
        { label: 'Ativo', value: (r: TabelaPreco) => (r.ativo === 1 ? 'Sim' : 'Não') },
      ], tabelas)}
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
            placeholder="Buscar em tabelas de preço…"
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
        <LoadingSpinner fullScreen text="Carregando tabelas de preço..." />
      ) : tabelas.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma tabela de preço cadastrada</p>
          <Button variant="primary" size="sm" onClick={openCreate} className="mt-4">Criar primeira tabela</Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Nome</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ajuste</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Vigência</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Itens</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Situação</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tabelas.map(t => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">{t.nome}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">
                    {TIPO_AJUSTE_LABEL[t.tipo_ajuste] ?? t.tipo_ajuste}
                    {t.valor_ajuste != null && (
                      <span className="ml-1 font-mono text-xs">
                        ({t.tipo_ajuste === 'percentual' ? `${t.valor_ajuste}%` : `R$ ${t.valor_ajuste}`})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400">
                    {t.vigencia_inicio || t.vigencia_fim ? `${fmtDate(t.vigencia_inicio)} — ${fmtDate(t.vigencia_fim)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-right text-slate-600 dark:text-slate-300 font-mono">{t.num_itens ?? 0}</td>
                  <td className="px-4 py-2.5 text-sm">
                    {t.ativo === 1 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Ativo</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(t)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleting(t)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors" title="Excluir">
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
        title={editing ? `Editar tabela — ${editing.nome}` : 'Nova tabela de preço'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              {editing ? 'Salvar alterações' : 'Criar tabela'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error" message={formError} className="mb-0" />}
          <Input
            label="Nome"
            name="tabela-nome"
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="ex: Tabela padrão, Atacado, Black Friday"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Tipo de ajuste"
              name="tabela-tipo-ajuste"
              value={form.tipoAjuste}
              onChange={e => set('tipoAjuste', e.target.value as TabelaPrecoTipoAjuste)}
              options={Object.entries(TIPO_AJUSTE_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <Input
              label={form.tipoAjuste === 'percentual' ? 'Valor do ajuste (%)' : 'Valor do ajuste (R$)'}
              name="tabela-valor-ajuste"
              value={form.valorAjuste}
              onChange={e => set('valorAjuste', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Vigência início"
              name="tabela-vigencia-inicio"
              type="date"
              value={form.vigenciaInicio}
              onChange={e => set('vigenciaInicio', e.target.value)}
            />
            <Input
              label="Vigência fim"
              name="tabela-vigencia-fim"
              type="date"
              value={form.vigenciaFim}
              onChange={e => set('vigenciaFim', e.target.value)}
            />
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={e => set('ativo', e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-0"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Tabela ativa</span>
          </label>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover tabela de preço"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover a tabela <strong>{deleting?.nome}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </BaseListPage>
  );
}
