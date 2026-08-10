import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import { inventariosService, STATUS_LABEL, type Inventario, type InventarioStatus } from '../../services/inventarios';
import { exportRowsToCsv } from '../../utils/exportCsv';

const STATUS_CLS: Record<InventarioStatus, string> = {
  aberto: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
  aplicado: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  cancelado: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
};

export default function InventariosPage() {
  const navigate = useNavigate();
  const [inventarios, setInventarios] = useState<Inventario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    inventariosService.list()
      .then(setInventarios)
      .catch(() => setError('Erro ao carregar inventários.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <BaseListPage
      title="Inventário"
      description="Contagem física de estoque — abra, preencha e aplique os ajustes"
      badge="NOVO CADASTRO"
      onExport={() => exportRowsToCsv('inventarios', [
        { label: 'Descrição', value: (r: Inventario) => r.descricao },
        { label: 'Local', value: (r: Inventario) => r.location ?? 'Todos' },
        { label: 'Status', value: (r: Inventario) => STATUS_LABEL[r.status] },
        { label: 'Itens', value: (r: Inventario) => r.num_itens },
        { label: 'Criado em', value: (r: Inventario) => r.created_at },
      ], inventarios)}
    >
      <div className="flex justify-end">
        <Button variant="primary" onClick={() => navigate('/estoque/inventario/novo')}>+ Novo inventário</Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}</div>
      ) : inventarios.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum inventário aberto ainda</p>
          <Button variant="primary" size="sm" onClick={() => navigate('/estoque/inventario/novo')} className="mt-4">Abrir primeiro inventário</Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-card overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Descrição</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Local</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Itens</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {inventarios.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => navigate(`/estoque/inventario/${inv.id}`)}>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100">{inv.descricao}</td>
                  <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300">{inv.location ?? 'Todos'}</td>
                  <td className="px-4 py-2.5 text-sm font-mono text-slate-500 dark:text-slate-400">{inv.num_itens}</td>
                  <td className="px-4 py-2.5 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_CLS[inv.status]}`}>{STATUS_LABEL[inv.status]}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-400 dark:text-slate-500">{new Date(inv.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BaseListPage>
  );
}
