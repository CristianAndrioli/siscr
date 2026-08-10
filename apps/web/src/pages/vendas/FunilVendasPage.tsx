import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BaseListPage from '../../components/common/BaseListPage';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import { fmtBRL } from '../../utils/format';
import {
  oportunidadesService, ESTAGIO_LABEL, ESTAGIOS_KANBAN,
  type Oportunidade, type Estagio,
} from '../../services/oportunidades';

const COLUNA_CLS: Record<Estagio, string> = {
  novo: 'border-t-slate-400',
  qualificado: 'border-t-sky-400',
  proposta: 'border-t-amber-400',
  negociacao: 'border-t-orange-500',
  ganho: 'border-t-positive dark:border-t-positive-dark',
  perdido: 'border-t-negative',
};

export default function FunilVendasPage() {
  const navigate = useNavigate();
  const [oportunidades, setOportunidades] = useState<Oportunidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Oportunidade | null>(null);

  const dragIdRef = useRef<string | null>(null);
  const [dragOverEstagio, setDragOverEstagio] = useState<Estagio | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    oportunidadesService.list()
      .then(setOportunidades)
      .catch(() => setError('Erro ao carregar o funil de vendas.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await oportunidadesService.delete(deleting.id);
      setDeleting(null);
      load();
    } catch {
      setError('Erro ao remover oportunidade.');
      setDeleting(null);
    }
  };

  const moverEstagio = async (id: string, estagio: Estagio) => {
    const atual = oportunidades.find(o => o.id === id);
    if (!atual || atual.estagio === estagio) return;

    let motivoPerda: string | undefined;
    if (estagio === 'perdido') {
      const resposta = window.prompt('Motivo da perda:');
      if (resposta === null) return;
      motivoPerda = resposta;
    }

    setOportunidades(prev => prev.map(o => o.id === id ? { ...o, estagio } : o));
    try {
      await oportunidadesService.mudarEstagio(id, estagio, motivoPerda);
    } catch {
      setError('Erro ao mover oportunidade de estágio.');
      load();
    }
  };

  const totalPorEstagio = (estagio: Estagio) =>
    oportunidades.filter(o => o.estagio === estagio).reduce((s, o) => s + o.valor_estimado, 0);

  return (
    <BaseListPage
      title="Funil de Vendas"
      description="Oportunidades comerciais por estágio — arraste os cards entre as colunas"
      badge="NOVO"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {oportunidades.length} oportunidade(s) · {fmtBRL(oportunidades.filter(o => !['ganho', 'perdido'].includes(o.estagio)).reduce((s, o) => s + o.valor_estimado, 0))} em aberto
        </p>
        <Button variant="primary" onClick={() => navigate('/vendas-crm/funil/novo')}>+ Nova oportunidade</Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
          {ESTAGIOS_KANBAN.map(estagio => {
            const cards = oportunidades.filter(o => o.estagio === estagio);
            return (
              <div
                key={estagio}
                onDragOver={e => { e.preventDefault(); setDragOverEstagio(estagio); }}
                onDragLeave={() => setDragOverEstagio(prev => prev === estagio ? null : prev)}
                onDrop={() => {
                  setDragOverEstagio(null);
                  if (dragIdRef.current) moverEstagio(dragIdRef.current, estagio);
                }}
                className={`rounded-xl border-t-4 ${COLUNA_CLS[estagio]} bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-2.5 min-h-[10rem] space-y-2 transition-colors ${dragOverEstagio === estagio ? 'ring-2 ring-brand-400' : ''}`}
              >
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{ESTAGIO_LABEL[estagio]}</h3>
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{cards.length}</span>
                </div>
                <p className="text-xs font-mono text-slate-400 dark:text-slate-500 px-1">{fmtBRL(totalPorEstagio(estagio))}</p>

                <div className="space-y-2">
                  {cards.map(card => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => { dragIdRef.current = card.id; }}
                      onDragEnd={() => { dragIdRef.current = null; }}
                      className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 shadow-card cursor-grab active:cursor-grabbing group"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{card.titulo}</p>
                        <button
                          onClick={() => setDeleting(card)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity shrink-0"
                          title="Remover"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      {card.pessoa_nome && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{card.pessoa_nome}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs font-mono font-semibold text-brand-700 dark:text-brand-400">{fmtBRL(card.valor_estimado)}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{card.probabilidade}%</span>
                      </div>
                      {card.vendedor_nome && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 truncate">{card.vendedor_nome}</p>}
                      {estagio !== 'perdido' && (
                        <div className="h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mt-2">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${card.probabilidade}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                  {cards.length === 0 && (
                    <div className="text-center py-6 text-[11px] text-slate-300 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                      Nenhuma
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        title="Remover oportunidade"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>Cancelar</Button>
            <Button variant="danger" onClick={handleDelete}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">Remover a oportunidade "{deleting?.titulo}"? Esta ação não pode ser desfeita.</p>
      </Modal>
    </BaseListPage>
  );
}
