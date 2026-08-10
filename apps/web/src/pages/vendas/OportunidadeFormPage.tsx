import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import { PessoaBusca } from '../../components/PessoaBusca';
import { formatApiError } from '../../utils/helpers';
import { oportunidadesService, type OportunidadeForm } from '../../services/oportunidades';

const emptyForm = (): OportunidadeForm => ({ titulo: '', valorEstimado: 0, probabilidade: 50 });

export default function OportunidadeFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<OportunidadeForm>(emptyForm());
  const [pessoaNome, setPessoaNome] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSave = async () => {
    if (!form.titulo.trim()) {
      setFormError('Informe um título para a oportunidade.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await oportunidadesService.create(form);
      navigate('/vendas-crm/funil');
    } catch (err) {
      setFormError(formatApiError(err, 'Erro ao criar oportunidade.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to="/vendas-crm/funil"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar ao funil
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          Nova oportunidade
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Cadastre uma oportunidade no estágio inicial do funil.
        </p>
      </div>

      {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <div>
          <label className="input-label">Título</label>
          <input
            className="input"
            value={form.titulo}
            onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
            placeholder="Ex.: Fornecimento de peças — Obra Norte"
          />
        </div>
        <div>
          <label className="input-label">Cliente (opcional)</label>
          <PessoaBusca
            value={form.pessoaId ?? ''}
            displayValue={pessoaNome}
            onChange={(id, nome) => {
              setForm((f) => ({ ...f, pessoaId: id || undefined }));
              setPessoaNome(nome);
            }}
            tipoCadastro="cliente"
            placeholder="Buscar cliente…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Valor estimado</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.valorEstimado}
              onChange={(e) => setForm((f) => ({ ...f, valorEstimado: Number(e.target.value) || 0 }))}
            />
          </div>
          <div>
            <label className="input-label">Probabilidade (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              className="input"
              value={form.probabilidade}
              onChange={(e) => setForm((f) => ({ ...f, probabilidade: Number(e.target.value) || 0 }))}
            />
          </div>
        </div>
        <div>
          <label className="input-label">Previsão de fechamento</label>
          <input
            type="date"
            className="input"
            value={form.dataPrevistaFechamento ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, dataPrevistaFechamento: e.target.value || undefined }))}
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={() => navigate('/vendas-crm/funil')} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Criar
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
