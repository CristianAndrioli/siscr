import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatApiError } from '../../utils/helpers';
import { fmtBRL, fmtDateISO } from '../../utils/format';
import {
  abastecimentosService,
  type Abastecimento,
} from '../../services/abastecimentos';
import { maquinasService, type Maquina } from '../../services/frota';

export default function AbastecimentosPage() {
  const navigate = useNavigate();
  const [abastecimentos, setAbastecimentos] = useState<Abastecimento[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [maquinas, setMaquinas] = useState<Maquina[]>([]);
  const [maquinaFiltro, setMaquinaFiltro] = useState('');
  const [deleting, setDeleting] = useState<Abastecimento | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await abastecimentosService.list({ maquinaId: maquinaFiltro || undefined, limit: 200 });
      setAbastecimentos(r.abastecimentos);
      setTotal(r.total);
    } catch (e) {
      setError(formatApiError(e, 'Erro ao carregar abastecimentos.'));
    } finally {
      setLoading(false);
    }
  }, [maquinaFiltro]);

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
      await abastecimentosService.delete(deleting.id);
      setSuccess('Abastecimento removido.');
      setDeleting(null);
      await carregar();
    } catch (e) {
      setError(formatApiError(e, 'Erro ao remover abastecimento.'));
      setDeleting(null);
    }
  };

  return (
    <BaseListPage
      title="Abastecimentos"
      description="Registro de abastecimentos de combustível por máquina"
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('abastecimentos', [
        { label: 'Data', value: (r: Abastecimento) => r.data },
        { label: 'Máquina', value: (r: Abastecimento) => r.maquina_nome ?? '' },
        { label: 'Litros', value: (r: Abastecimento) => r.litros },
        { label: 'Valor total', value: (r: Abastecimento) => r.valor_total },
        { label: 'Horímetro', value: (r: Abastecimento) => r.horimetro ?? '' },
        { label: 'Posto', value: (r: Abastecimento) => r.posto ?? '' },
      ], abastecimentos)}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
        <Button variant="primary" onClick={() => navigate('/frota/abastecimentos/novo')}>+ Novo abastecimento</Button>
      </div>

      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}
      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <LoadingSpinner fullScreen text="Carregando abastecimentos..." />
      ) : abastecimentos.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum abastecimento cadastrado</p>
          <Button variant="primary" size="sm" onClick={() => navigate('/frota/abastecimentos/novo')} className="mt-4">Criar primeiro abastecimento</Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Data</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Máquina</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Litros</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Valor total</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Horímetro</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Posto</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {abastecimentos.map(a => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{fmtDateISO(a.data)}</td>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">{a.maquina_nome ?? '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums text-slate-600 dark:text-slate-300">{Number(a.litros).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} L</td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums font-semibold text-slate-800 dark:text-slate-100">{fmtBRL(Number(a.valor_total))}</td>
                  <td className="px-4 py-2.5 text-sm text-right tabular-nums text-slate-600 dark:text-slate-300">{a.horimetro != null ? Number(a.horimetro).toLocaleString('pt-BR') : '—'}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{a.posto ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => navigate(`/frota/abastecimentos/${a.id}`)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:text-brand-400 dark:hover:bg-brand-950 transition-colors" title="Editar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => setDeleting(a)} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950 transition-colors" title="Excluir">
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
        title="Remover abastecimento"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Remover o abastecimento de <strong>{deleting?.maquina_nome}</strong> em {deleting ? fmtDateISO(deleting.data) : ''}? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </BaseListPage>
  );
}
