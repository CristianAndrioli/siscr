import { useState, useEffect, useCallback } from 'react';
import {
  permissoesApi,
  type PerfilRow,
  type ModuloPerm,
  type ModuleKey,
} from '../../services/permissoesApi';

const MODULOS: { id: ModuleKey; label: string; desc: string }[] = [
  { id: 'cadastros', label: 'Cadastros', desc: 'Pessoas, produtos, serviços' },
  { id: 'financeiro', label: 'Financeiro', desc: 'Contas a pagar/receber, dashboard' },
  { id: 'faturamento', label: 'Faturamento', desc: 'Cotações, NF-e, NFS-e' },
  { id: 'estoque', label: 'Estoque', desc: 'Posição, movimentações, locais' },
  { id: 'configuracoes', label: 'Configurações', desc: 'Usuários, empresas, permissões' },
];

const emptyModulos = (): ModuloPerm[] =>
  MODULOS.map((m) => ({ moduleKey: m.id, canView: false, canEdit: false }));

interface Props {
  isAdmin: boolean;
  onChanged?: () => void;
}

export function PerfisPersonalizadosSection({ isAdmin, onChanged }: Props) {
  const [perfis, setPerfis] = useState<PerfilRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [modulos, setModulos] = useState<ModuloPerm[]>(emptyModulos);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await permissoesApi.listPerfis();
      setPerfis(res.data.perfis ?? []);
    } catch {
      setError('Não foi possível carregar os perfis personalizados.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditingId(null);
    setNome('');
    setModulos(emptyModulos());
    setModalOpen(true);
  };

  const openEdit = async (id: string) => {
    setError('');
    try {
      const res = await permissoesApi.getPerfil(id);
      setEditingId(id);
      setNome(res.data.perfil.nome);
      const map = new Map(res.data.modulos.map((m) => [m.moduleKey, m]));
      setModulos(
        MODULOS.map((m) => {
          const ex = map.get(m.id);
          return ex ?? { moduleKey: m.id, canView: false, canEdit: false };
        })
      );
      setModalOpen(true);
    } catch {
      setError('Erro ao carregar perfil.');
    }
  };

  const toggleView = (key: ModuleKey) => {
    setModulos((prev) =>
      prev.map((p) =>
        p.moduleKey === key
          ? { ...p, canView: !p.canView, canEdit: !p.canView ? false : p.canEdit }
          : p
      )
    );
  };

  const toggleEdit = (key: ModuleKey) => {
    setModulos((prev) =>
      prev.map((p) => {
        if (p.moduleKey !== key) return p;
        const nextEdit = !p.canEdit;
        return { ...p, canEdit: nextEdit, canView: nextEdit ? true : p.canView };
      })
    );
  };

  const save = async () => {
    if (!nome.trim()) return;
    const valid = modulos.filter((m) => m.canView || m.canEdit);
    if (valid.length === 0) {
      setError('Marque ao menos um módulo.');
      return;
    }
    if (valid.some((m) => m.canEdit && !m.canView)) {
      setError('Para editar, é necessário permitir visualizar o módulo.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const body = { nome: nome.trim(), modulos: valid };
      if (editingId) await permissoesApi.updatePerfil(editingId, body);
      else await permissoesApi.createPerfil(body);
      setModalOpen(false);
      load();
      onChanged?.();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!deleteId) return;
    try {
      await permissoesApi.deletePerfil(deleteId);
      setDeleteId(null);
      load();
      onChanged?.();
    } catch {
      setError('Erro ao excluir perfil.');
    }
  };

  if (!isAdmin) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-6 text-sm text-slate-600 dark:text-slate-400">
        Apenas administradores podem criar e editar perfis personalizados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Crie perfis com permissões por módulo e atribua-os em <strong>Usuários</strong> (exceto contas administradoras).
        </p>
        <button
          type="button"
          onClick={openNew}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg"
        >
          Novo perfil personalizado
        </button>
      </div>

      {error && !modalOpen && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12 text-slate-400">Carregando…</div>
      ) : perfis.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          Nenhum perfil personalizado. Crie um para combinar permissões finas por módulo.
        </div>
      ) : (
        <div className="space-y-2">
          {perfis.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">{p.nome}</p>
                <p className="text-xs text-slate-400">
                  {p.usuarios_count} usuário(s) · criado em{' '}
                  {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(p.id)}
                  className="text-sm text-brand-600 dark:text-brand-400 font-medium"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(p.id)}
                  className="text-sm text-red-500 font-medium"
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {editingId ? 'Editar perfil' : 'Novo perfil personalizado'}
            </h3>
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do perfil</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                placeholder="Ex.: Vendas — só leitura financeiro"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Módulos</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="pb-2">Módulo</th>
                    <th className="pb-2 w-20 text-center">Ver</th>
                    <th className="pb-2 w-20 text-center">Editar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {MODULOS.map((m) => {
                    const row = modulos.find((x) => x.moduleKey === m.id)!;
                    return (
                      <tr key={m.id}>
                        <td className="py-2 pr-2">
                          <span className="text-slate-800 dark:text-slate-200">{m.label}</span>
                          <p className="text-xs text-slate-400">{m.desc}</p>
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={row.canView}
                            onChange={() => toggleView(m.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                        <td className="text-center">
                          <input
                            type="checkbox"
                            checked={row.canEdit}
                            onChange={() => toggleEdit(m.id)}
                            className="rounded border-slate-300"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setError('');
                }}
                className="flex-1 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="flex-1 py-2.5 text-sm bg-brand-600 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl border p-6 max-w-sm space-y-4 shadow-xl">
            <p className="text-slate-800 dark:text-slate-100 font-medium">Excluir este perfil?</p>
            <p className="text-sm text-slate-500">
              Usuários vinculados perderão o perfil personalizado e voltarão às permissões do perfil padrão (Gerente, Usuário, etc.).
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setDeleteId(null)} className="flex-1 py-2 border rounded-lg text-sm">
                Cancelar
              </button>
              <button type="button" onClick={del} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
