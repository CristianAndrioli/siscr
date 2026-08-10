import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Alert from '../../components/common/Alert';
import { locaisService, type Local } from '../../services/estoqueService';
import { inventariosService } from '../../services/inventarios';
import { formatApiError } from '../../utils/helpers';

export default function InventarioFormPage() {
  const navigate = useNavigate();
  const [locais, setLocais] = useState<Local[]>([]);
  const [descricao, setDescricao] = useState('');
  const [location, setLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    locaisService.list().then(setLocais).catch(() => {});
  }, []);

  const handleAbrir = async () => {
    if (!descricao.trim()) {
      setFormError('Informe uma descrição.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const r = await inventariosService.abrir(descricao.trim(), location || undefined);
      navigate(`/estoque/inventario/${r.id}`);
    } catch (err) {
      setFormError(formatApiError(err, 'Erro ao abrir inventário.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to="/estoque/inventario"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar aos inventários
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          Novo inventário
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Abra um inventário a partir da posição atual de estoque (snapshot).
        </p>
      </div>

      {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <Input
          label="Descrição"
          name="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Contagem mensal — Julho/2026"
          required
        />
        <div>
          <label className="input-label">Local (opcional — vazio = todos)</label>
          <select className="input" value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value="">Todos os locais</option>
            {locais.map((l) => (
              <option key={l.id} value={l.nome}>
                {l.nome}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          O inventário parte da posição de estoque atual (snapshot) no momento da abertura.
        </p>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={() => navigate('/estoque/inventario')} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleAbrir} loading={saving}>
            Abrir inventário
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
