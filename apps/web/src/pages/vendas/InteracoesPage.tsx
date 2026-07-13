import { useState, useEffect, useCallback } from 'react';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import { PessoaBusca } from '../../components/PessoaBusca';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatApiError } from '../../utils/helpers';
import {
  pessoaInteracoesService, TIPO_INTERACAO_LABEL,
  type Interacao, type InteracaoForm, type InteracaoTipo,
} from '../../services/pessoaInteracoes';

const hoje = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): InteracaoForm => ({ pessoaId: '', tipo: 'ligacao', data: hoje(), descricao: '' });

export default function InteracoesPage() {
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroPessoaId, setFiltroPessoaId] = useState('');
  const [filtroPessoaNome, setFiltroPessoaNome] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<InteracaoForm>(emptyForm());
  const [pessoaNome, setPessoaNome] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState<Interacao | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    pessoaInteracoesService.list({ pessoaId: filtroPessoaId || undefined })
      .then(setInteracoes)
      .catch(() => setError('Erro ao carregar histórico de interações.'))
      .finally(() => setLoading(false));
  }, [filtroPessoaId]);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setForm(emptyForm());
    setPessoaNome('');
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.pessoaId || !form.descricao.trim()) {
      setFormError('Selecione a pessoa e descreva a interação.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await pessoaInteracoesService.create(form);
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(formatApiError(err, 'Erro ao registrar interação.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await pessoaInteracoesService.delete(deleting.id);
      setDeleting(null);
      load();
    } catch {
      setError('Erro ao remover interação.');
      setDeleting(null);
    }
  };

  return (
    <BaseListPage
      title="Histórico de Interações"
      description="Ligações, e-mails, reuniões e visitas registradas com clientes e fornecedores"
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('interacoes', [
        { label: 'Data', value: (r: Interacao) => r.data },
        { label: 'Pessoa', value: (r: Interacao) => r.pessoa_nome },
        { label: 'Tipo', value: (r: Interacao) => TIPO_INTERACAO_LABEL[r.tipo] },
        { label: 'Descrição', value: (r: Interacao) => r.descricao },
      ], interacoes)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 max-w-sm">
          <PessoaBusca
            value={filtroPessoaId}
            displayValue={filtroPessoaNome}
            onChange={(id, nome) => { setFiltroPessoaId(id); setFiltroPessoaNome(nome); }}
            placeholder="Filtrar por cliente/fornecedor…"
          />
        </div>
        <Button variant="primary" onClick={openNew}>+ Nova interação</Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}</div>
      ) : interacoes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma interação registrada</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Data</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Pessoa</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Descrição</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {interacoes.map(it => (
                <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-sm font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">{new Date(it.data).toLocaleDateString('pt-BR')}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-800 dark:text-slate-100">{it.pessoa_nome}</td>
                  <td className="px-4 py-2.5 text-sm">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {TIPO_INTERACAO_LABEL[it.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 max-w-md truncate">{it.descricao}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setDeleting(it)} className="text-xs text-red-500 hover:underline font-medium">Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova interação"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>Registrar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error" message={formError} className="mb-0" />}
          <div>
            <label className="input-label">Pessoa</label>
            <PessoaBusca
              value={form.pessoaId}
              displayValue={pessoaNome}
              onChange={(id, nome) => { setForm(f => ({ ...f, pessoaId: id })); setPessoaNome(nome); }}
              placeholder="Buscar cliente ou fornecedor…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="input-label">Tipo</label>
              <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as InteracaoTipo }))}>
                {Object.entries(TIPO_INTERACAO_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label">Data</label>
              <input type="date" className="input" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="input-label">Descrição</label>
            <textarea className="input h-auto py-2" rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="O que foi tratado…" />
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover interação"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">Remover este registro de interação? Esta ação não pode ser desfeita.</p>
      </Modal>
    </BaseListPage>
  );
}
