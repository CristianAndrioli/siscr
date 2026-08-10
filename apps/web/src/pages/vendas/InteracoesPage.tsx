import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import { PessoaBusca } from '../../components/PessoaBusca';
import { exportRowsToCsv } from '../../utils/exportCsv';
import {
  pessoaInteracoesService, TIPO_INTERACAO_LABEL,
  type Interacao,
} from '../../services/pessoaInteracoes';

export default function InteracoesPage() {
  const navigate = useNavigate();
  const [interacoes, setInteracoes] = useState<Interacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filtroPessoaId, setFiltroPessoaId] = useState('');
  const [filtroPessoaNome, setFiltroPessoaNome] = useState('');
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
        <Button variant="primary" onClick={() => navigate('/vendas-crm/interacoes/novo')}>+ Nova interação</Button>
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
