import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { pessoasService, type Pessoa, type PessoaCadastroTipo } from '../../services/cadastros/pessoas';
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

const BASE_COLUMNS: SmartColumn<Pessoa>[] = [
  { key: 'codigo', label: '#', width: 70, required: true, align: 'center',
    render: v => <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">{v != null && v !== '' ? String(v) : '—'}</span> },
  { key: 'nome', label: 'Nome', width: 240, required: true,
    render: v => <span className="font-medium text-slate-800 dark:text-slate-100">{String(v ?? '—')}</span> },
  { key: 'cpf_cnpj', label: 'CPF/CNPJ', width: 150,
    render: v => <span className="text-slate-600 dark:text-slate-300 font-mono text-xs">{v != null && v !== '' ? formatCPFCNPJ(String(v)) : '—'}</span> },
];

const TAIL_COLUMNS: SmartColumn<Pessoa>[] = [
  { key: 'email', label: 'E-mail', width: 200 },
  { key: 'telefone', label: 'Telefone', width: 130 },
];

/**
 * Tela de listagem genérica para os "papéis" de Pessoa (Clientes,
 * Fornecedores, Vendedores, Transportadoras, Funcionários/Operadores) —
 * reaproveita a mesma entidade/rota/detail de `pessoasService` filtrada
 * por `tipo_cadastro`, evitando duplicar CRUD para cada papel.
 */
export default function PessoaCadastroList({
  tipoCadastro, title, description, extraColumns, csvSlug,
}: {
  tipoCadastro: PessoaCadastroTipo;
  title: string;
  description: string;
  extraColumns?: SmartColumn<Pessoa>[];
  csvSlug: string;
}) {
  const navigate = useNavigate();
  const { reportError } = useErrorNotification();
  const gridId = `pessoas-${tipoCadastro}-list`;
  const columns: SmartColumn<Pessoa>[] = [...BASE_COLUMNS, ...(extraColumns ?? []), ...TAIL_COLUMNS];

  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => loadGridListPage(gridId));
  const [pageSize, setPageSize] = useState<GridPageSize>(() =>
    normalizeGridPageSize(loadGridPreferences(gridId)?.pageSize),
  );
  const [loading, setLoading] = useState(true);
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
        tipoCadastro,
      });
      setPessoas(r.pessoas);
      setTotal(r.total);
      const maxPage = Math.max(0, Math.ceil(r.total / Math.max(r.limit, 1)) - 1);
      if (page > maxPage) setPage(maxPage);
    } catch {
      setError(`Erro ao carregar ${title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, pageSize, tipoCadastro, title]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja excluir "${nome}"?`)) return;
    try {
      await pessoasService.delete(id);
      await load();
    } catch (err) {
      const msg = formatApiError(err, `Erro ao excluir ${title.toLowerCase()}.`);
      reportError(msg, err, title);
      setError(msg);
    }
  };

  return (
    <BaseListPage
      title={title}
      description={description}
      badge={['vendedor', 'transportadora', 'funcionario'].includes(tipoCadastro) ? 'NOVO CADASTRO' : undefined}
      onExport={() => exportRowsToCsv(csvSlug, smartColumnsToCsv(columns), pessoas)}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(0);
          setAppliedSearch(searchInput.trim());
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={`Buscar em ${title.toLowerCase()}…`}
          className="flex-1 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button type="submit" className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Buscar
        </button>
      </form>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <SmartGrid<Pessoa>
        gridId={gridId}
        data={pessoas}
        columns={columns}
        defaultSort={{ key: 'codigo', dir: 'asc' }}
        loading={loading}
        emptyMessage={`Nenhum registro em ${title.toLowerCase()}.`}
        onRowClick={p => navigate(`/cadastros/pessoas/${p.id}`)}
        onCreate={() => navigate(`/cadastros/pessoas/novo?tipo=${tipoCadastro}`)}
        createLabel="+ Novo"
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

const fmtPct = (v: unknown) => v != null && v !== '' ? `${v}%` : '—';
const fmtNum = (v: unknown) => v != null && v !== '' ? String(v) : '—';

const TIPO_OPERADOR_LABEL: Record<string, string> = {
  motorista: 'Motorista', operador_maquina: 'Operador de máquina', tecnico: 'Técnico',
  administrativo: 'Administrativo', outro: 'Outro',
};

export function ClientesList() {
  return <PessoaCadastroList tipoCadastro="cliente" title="Clientes" description="Pessoas físicas ou jurídicas que compram de você" csvSlug="clientes" />;
}

export function FornecedoresList() {
  return <PessoaCadastroList tipoCadastro="fornecedor" title="Fornecedores" description="Pessoas físicas ou jurídicas que fornecem produtos/serviços" csvSlug="fornecedores" />;
}

export function TransportadorasList() {
  return <PessoaCadastroList tipoCadastro="transportadora" title="Transportadoras" description="Empresas responsáveis pelo frete das entregas" csvSlug="transportadoras" />;
}

export function VendedoresList() {
  return (
    <PessoaCadastroList
      tipoCadastro="vendedor"
      title="Vendedores"
      description="Equipe comercial e suas comissões"
      csvSlug="vendedores"
      extraColumns={[
        { key: 'comissao_percentual', label: 'Comissão', width: 100, align: 'right', render: fmtPct },
        { key: 'meta_mensal', label: 'Meta mensal', width: 120, align: 'right', render: fmtNum },
      ]}
    />
  );
}

export function FuncionariosList() {
  return (
    <PessoaCadastroList
      tipoCadastro="funcionario"
      title="Funcionários / Operadores"
      description="Equipe operacional — motoristas, operadores de máquina e técnicos"
      csvSlug="funcionarios-operadores"
      extraColumns={[
        { key: 'matricula', label: 'Matrícula', width: 110, render: fmtNum },
        { key: 'tipo_operador', label: 'Função', width: 150, render: v => TIPO_OPERADOR_LABEL[String(v)] ?? fmtNum(v) },
      ]}
    />
  );
}
