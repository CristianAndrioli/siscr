import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pessoasService, type Pessoa } from '../../services/cadastros/pessoas';
import { formatCPFCNPJ } from '../../utils/formatters';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { formatApiError } from '../../utils/helpers';
import SmartGrid, { GridDeleteBtn, type SmartColumn } from '../../components/common/SmartGrid';
import BaseListPage from '../../components/common/BaseListPage';
import { exportRowsToCsv, smartColumnsToCsv } from '../../utils/exportCsv';
import {
  loadGridListPage,
  loadGridPreferences,
  normalizeGridPageSize,
  type GridPageSize,
} from '../../utils/gridPreferences';

const GRID_ID = 'pessoas-list';

const TIPO_CADASTRO_LABEL: Record<string, string> = {
  cliente: 'Cliente',
  fornecedor: 'Fornecedor',
  funcionario: 'Funcionário',
  transportadora: 'Transportadora',
};

const COLUMNS: SmartColumn<Pessoa>[] = [
  { key: 'codigo', label: '#', width: 70, required: true, align: 'center',
    render: v => <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{v != null && v !== '' ? String(v) : '—'}</span> },
  { key: 'nome', label: 'Nome', width: 220, required: true,
    render: v => <span className="font-medium text-slate-800 dark:text-slate-100">{String(v ?? '—')}</span> },
  { key: 'tipo_cadastro', label: 'Tipo', width: 130,
    render: v => (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
        {TIPO_CADASTRO_LABEL[String(v)] ?? String(v)}
      </span>
    ) },
  { key: 'cpf_cnpj', label: 'CPF/CNPJ', width: 150,
    render: v => <span className="text-slate-600 dark:text-slate-300 font-mono text-xs">{v != null && v !== '' ? formatCPFCNPJ(String(v)) : '—'}</span> },
  { key: 'email', label: 'E-mail', width: 200 },
  { key: 'telefone', label: 'Telefone', width: 130 },
];

export function PessoasList() {
  const navigate = useNavigate();
  const { reportError, notify } = useErrorNotification();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => loadGridListPage(GRID_ID));
  const [pageSize, setPageSize] = useState<GridPageSize>(() =>
    normalizeGridPageSize(loadGridPreferences(GRID_ID)?.pageSize),
  );
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await pessoasService.list({
        search: appliedSearch || undefined,
        page,
        limit: pageSize,
      });
      setPessoas(r.pessoas);
      setTotal(r.total);
      const maxPage = Math.max(0, Math.ceil(r.total / Math.max(r.limit, 1)) - 1);
      if (page > maxPage) setPage(maxPage);
    } catch {
      setError('Erro ao carregar cadastro de pessoas.');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja excluir "${nome}"?`)) return;
    try {
      await pessoasService.delete(id);
      await load();
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao excluir pessoa.');
      reportError(msg, err, 'Cadastro de Pessoa');
      setError(msg);
    }
  };

  const handleSeedDemo = async () => {
    if (
      !window.confirm(
        'Importar clientes, fornecedores, produtos e serviços de demonstração? Pode ser feito uma vez por tenant.',
      )
    ) {
      return;
    }
    setSeeding(true);
    setError('');
    try {
      const r = await pessoasService.seedDemo();
      notify(
        `${r.message || 'Importado.'} Pessoas: ${r.pessoas}, produtos: ${r.produtos}, serviços: ${r.servicos}.`,
        'success',
      );
      await load();
    } catch (err) {
      const msg = formatApiError(err, 'Erro ao importar dados de demonstração.');
      setError(msg);
      notify(msg, 'warning');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <BaseListPage
      title="Pessoas"
      description="Clientes, fornecedores e funcionários"
      onExport={() => exportRowsToCsv('pessoas', smartColumnsToCsv(COLUMNS), pessoas)}
    >
      <div className="flex flex-wrap gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setAppliedSearch(searchInput.trim());
          }}
          className="flex gap-2 flex-1 min-w-[240px]"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome ou CPF/CNPJ..."
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button type="submit" className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Buscar
          </button>
        </form>
        <button
          type="button"
          onClick={() => void handleSeedDemo()}
          disabled={seeding}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          {seeding ? 'Importando…' : 'Importar dados demo'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <SmartGrid<Pessoa>
        gridId={GRID_ID}
        data={pessoas}
        columns={COLUMNS}
        defaultSort={{ key: 'codigo', dir: 'asc' }}
        loading={loading}
        emptyMessage="Nenhuma pessoa cadastrada."
        onRowClick={p => navigate(`/cadastros/pessoas/${p.id}`)}
        onCreate={() => navigate('/cadastros/pessoas/novo')}
        createLabel="Nova Pessoa"
        actions={p => (
          <GridDeleteBtn onClick={e => { e.stopPropagation(); handleDelete(String(p.id), String(p.nome)); }} />
        )}
        serverPagination={{
          total,
          page,
          pageSize,
          onPageChange: setPage,
          onPageSizeChange: (n) => {
            setPageSize(normalizeGridPageSize(n));
            setPage(0);
          },
        }}
      />
    </BaseListPage>
  );
}

export default PessoasList;
