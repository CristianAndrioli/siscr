import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Alert from '../../components/common/Alert';
import { locaisService, type Local } from '../../services/estoqueService';
import { inventariosService, STATUS_LABEL, type Inventario, type InventarioStatus } from '../../services/inventarios';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatApiError } from '../../utils/helpers';

const STATUS_CLS: Record<InventarioStatus, string> = {
  aberto: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
  aplicado: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
  cancelado: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400',
};

export default function InventariosPage() {
  const navigate = useNavigate();
  const [inventarios, setInventarios] = useState<Inventario[]>([]);
  const [locais, setLocais] = useState<Local[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    inventariosService.list()
      .then(setInventarios)
      .catch(() => setError('Erro ao carregar inventários.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { locaisService.list().then(setLocais).catch(() => {}); }, []);

  const openNew = () => {
    setDescricao('');
    setLocation('');
    setFormError('');
    setModalOpen(true);
  };

  const handleAbrir = async () => {
    if (!descricao.trim()) { setFormError('Informe uma descrição.'); return; }
    setSaving(true);
    setFormError('');
    try {
      const r = await inventariosService.abrir(descricao.trim(), location || undefined);
      setModalOpen(false);
      navigate(`/estoque/inventario/${r.id}`);
    } catch (err) {
      setFormError(formatApiError(err, 'Erro ao abrir inventário.'));
    } finally {
      setSaving(false);
    }
  };

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
        <Button variant="primary" onClick={openNew}>+ Novo inventário</Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}</div>
      ) : inventarios.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Nenhum inventário aberto ainda</p>
          <Button variant="primary" size="sm" onClick={openNew} className="mt-4">Abrir primeiro inventário</Button>
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

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo inventário"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleAbrir} loading={saving}>Abrir inventário</Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Alert type="error" message={formError} className="mb-0" />}
          <Input label="Descrição" name="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Contagem mensal — Julho/2026" required />
          <div>
            <label className="input-label">Local (opcional — vazio = todos)</label>
            <select className="input" value={location} onChange={e => setLocation(e.target.value)}>
              <option value="">Todos os locais</option>
              {locais.map(l => <option key={l.id} value={l.nome}>{l.nome}</option>)}
            </select>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">O inventário parte da posição de estoque atual (snapshot) no momento da abertura.</p>
        </div>
      </Modal>
    </BaseListPage>
  );
}
