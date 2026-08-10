import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageContainer from '../../components/common/PageContainer';
import Button from '../../components/common/Button';
import Alert from '../../components/common/Alert';
import { PessoaBusca } from '../../components/PessoaBusca';
import { formatApiError } from '../../utils/helpers';
import {
  pessoaInteracoesService,
  TIPO_INTERACAO_LABEL,
  type InteracaoForm,
  type InteracaoTipo,
} from '../../services/pessoaInteracoes';

const hoje = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): InteracaoForm => ({ pessoaId: '', tipo: 'ligacao', data: hoje(), descricao: '' });

export default function InteracaoFormPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<InteracaoForm>(emptyForm());
  const [pessoaNome, setPessoaNome] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSave = async () => {
    if (!form.pessoaId || !form.descricao.trim()) {
      setFormError('Selecione a pessoa e descreva a interação.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await pessoaInteracoesService.create(form);
      navigate('/vendas-crm/interacoes');
    } catch (err) {
      setFormError(formatApiError(err, 'Erro ao registrar interação.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer variant="form" className="space-y-6 pb-16">
      <div>
        <Link
          to="/vendas-crm/interacoes"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1 mb-2"
        >
          ← Voltar às interações
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 font-display">
          Nova interação
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Registre ligação, e-mail, reunião ou visita com o cliente/fornecedor.
        </p>
      </div>

      {formError && <Alert type="error" message={formError} onClose={() => setFormError('')} />}

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
        <div>
          <label className="input-label">Pessoa</label>
          <PessoaBusca
            value={form.pessoaId}
            displayValue={pessoaNome}
            onChange={(id, nome) => {
              setForm((f) => ({ ...f, pessoaId: id }));
              setPessoaNome(nome);
            }}
            placeholder="Buscar cliente ou fornecedor…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="input-label">Tipo</label>
            <select
              className="input"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as InteracaoTipo }))}
            >
              {Object.entries(TIPO_INTERACAO_LABEL).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="input-label">Data</label>
            <input
              type="date"
              className="input"
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="input-label">Descrição</label>
          <textarea
            className="input h-auto py-2"
            rows={3}
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            placeholder="O que foi tratado…"
          />
        </div>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="secondary" onClick={() => navigate('/vendas-crm/interacoes')} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Registrar
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
