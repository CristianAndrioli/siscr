import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatApiError } from '../../utils/helpers';
import { fmtDateISO } from '../../utils/format';
import {
  manutencoesFrotaService,
  TIPO_LABEL,
  STATUS_LABEL,
  type ManutencaoFrota,
  type ManutencaoStatus,
} from '../../services/manutencoesFrota';
import { maquinasService, type Maquina } from '../../services/frota';

const STATUS_STYLE: Record<ManutencaoStatus, string> = {
  pendente: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  concluida: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  cancelada: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

export default function ManutencoesFrotaPage() {
  const navigate = useNavigate();
  const [manutencoes, setManutencoes] = useState<ManutencaoFrota[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [maquinaFiltro, setMaquinaFiltro] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [deleting, setDeleting] = useState<ManutencaoFrota | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await manutencoesFrotaService.list({
        maquinaId: maquinaFiltro || undefined,
        status: statusFiltro || undefined,
        limit: 200,
      });
      setManutencoes(r.manutencoes);
      setTotal(r.total);
    } catch (e) {
      setError(formatApiError(e, 'Erro ao carregar manutenções.'));
    } finally {
      setLoading(false);
    }
  }, [maquinaFiltro, statusFiltro]);

  useEffect(() => { void carregar(); }, [carregar]);

  useEffect(() => {
    (async () => {
      try {
        const m = await maquinasService.list({ limit: 200 });
        setMaquinas(m.maquinas);
      } catch {
        // seletor fica vazio
      }
    })();
  }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await manutencoesFrotaService.delete(deleting.id);
      setSuccess('Manutenção removida.');
      setDeleting(null);
      await carregar();
    } catch (e) {
      setError(formatApiError(e, 'Erro ao remover manutenção.'));
      setDeleting(null);
    }
  };

  return (
    <BaseListPage
      title="Manutenções Programadas"
      description="Agenda de manutenções preventivas e corretivas das máquinas"
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('manutencoes-frota', [
        { label: 'Máquina', value: (r: ManutencaoFrota) => r.maquina_nome ?? '' },
        { label: 'Tipo', value: (r: ManutencaoFrota) => TIPO_LABEL[r.tipo] },
        { label: 'Descrição', value: (r: ManutencaoFrota) => r.descricao },
        { label: 'Data prevista', value: (r: ManutencaoFrota) => r.data_prevista ?? '' },
        { label: 'Status', value: (r: ManutencaoFrota) => STATUS_LABEL[r.status] },
        { label: 'Custo', value: (r: ManutencaoFrota) => r.custo ?? '' },
      ], manutencoes)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={maquinaFiltro}
            onChange={e => setMaquinaFiltro(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todas as máquinas</option>
            {maquinas.map(m => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </select>
          <select
            value={statusFiltro}
            onChange={e => setStatusFiltro(e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="concluida">Concluída</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        <Button variant="primary" onClick={() => navigate('/frota/manutencoes/novo')}>+ Nova manutenção</Button>
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <LoadingSpinner fullScreen text="Carregando manutenções..." />
      ) : manutencoes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhuma manutenção cadastrada</p>
          <Button variant="primary" size="sm" onClick={() => navigate('/frota/manutencoes/novo')} className="mt-4">Criar primeira manutenção</Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Máquina</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Descrição</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Data prevista</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {manutencoes.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">{m.maquina_nome ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{TIPO_LABEL[m.tipo]}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 max-w-xs truncate" title={m.descricao}>{m.descricao}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{m.data_prevista ? fmtDateISO(m.data_prevista) : '—'}</td>
                  <td className="px-4 py-2.5 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLE[m.status]}`}>
                      {STATUS_LABEL[m.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => navigate(`/frota/manutencoes/${m.id}`)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleting(m)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors" title="Excluir">
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
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover manutenção"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover a manutenção <strong>{deleting?.descricao}</strong> de <strong>{deleting?.maquina_nome}</strong>? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </BaseListPage>
  );
}
