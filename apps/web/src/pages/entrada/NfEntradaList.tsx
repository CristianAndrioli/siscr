import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import * as entradaService from '../../services/entradaService';
import { fmtBRL, fmtDate } from '../../utils/format';
import BaseListPage from '../../components/common/BaseListPage';
import SmartGrid, { type SmartColumn } from '../../components/common/SmartGrid';
import { exportRowsToCsv, smartColumnsToCsv } from '../../utils/exportCsv';

interface EmpresaRow {
  id: string;
  razao_social: string;
}

const GRID_ID = 'nf-entrada-list';

const ORIGEM_LABEL: Record<string, string> = {
  xml: 'XML',
  manual: 'Manual',
};

const STATUS_CLS: Record<string, string> = {
  importada: 'bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300',
  lancada: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300',
};

export default function NfEntradaList() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState<EmpresaRow[]>([]);
  const [empresaId, setEmpresaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [entradas, setEntradas] = useState<entradaService.NfEntradaListItem[]>([]);

  useEffect(() => {
    api
      .get('/tenant/info/empresas')
      .then((r) => {
        const elist = (r.data?.empresas ?? []) as EmpresaRow[];
        setEmpresas(elist);
        setEmpresaId((prev) => prev || elist[0]?.id || '');
      })
      .catch(() => setError('Não foi possível carregar empresas.'));
  }, []);

  const load = useCallback(async () => {
    if (!empresaId) return;
    setLoading(true);
    setError('');
    try {
      const r = await entradaService.listNfEntradas({ empresaId, limit: 200, page: 0 });
      setEntradas(r.entradas ?? []);
    } catch {
      setError('Erro ao listar notas de entrada.');
    } finally {
      setLoading(false);
    }
  }, [empresaId]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: SmartColumn<entradaService.NfEntradaListItem>[] = [
    {
      key: 'numero',
      label: 'Nº / Série',
      width: 100,
      align: 'center',
      required: true,
      render: (_v, row) => (
        <span className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-300">
          {row.numero ?? '—'}/{row.serie ?? '—'}
        </span>
      ),
    },
    {
      key: 'emitente_nome',
      label: 'Fornecedor',
      width: 240,
      required: true,
      render: (_v, row) => (
        <div>
          <div className="font-medium text-slate-800 dark:text-slate-100 truncate">
            {row.fornecedor_nome || row.emitente_nome || row.emitente_cnpj || '—'}
          </div>
          {row.fornecedor_nome && row.emitente_nome && row.fornecedor_nome !== row.emitente_nome ? (
            <div className="text-[11px] text-slate-400 truncate">{row.emitente_nome}</div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'origem',
      label: 'Origem',
      width: 90,
      render: (v) => (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {ORIGEM_LABEL[String(v || 'xml')] || String(v || 'xml')}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 110,
      render: (v) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            STATUS_CLS[String(v)] || 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}
        >
          {String(v || '—')}
        </span>
      ),
    },
    {
      key: 'data_emissao',
      label: 'Emissão',
      width: 110,
      render: (v) => (v ? fmtDate(String(v)) : '—'),
    },
    {
      key: 'valor_total',
      label: 'Valor',
      width: 130,
      align: 'right',
      render: (v) => (
        <span className="font-mono text-slate-700 dark:text-slate-200">{fmtBRL(Number(v))}</span>
      ),
    },
  ];

  return (
    <BaseListPage
      title="Notas de entrada"
      description="NF-e de compra — importação XML ou lançamento manual"
      onExport={() => exportRowsToCsv('nf-entrada', smartColumnsToCsv(columns), entradas)}
    >
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={empresaId}
          onChange={(e) => setEmpresaId(e.target.value)}
          className="input w-auto"
        >
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.razao_social}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary text-sm"
          onClick={() => navigate('/entrada/nf-e/nova')}
        >
          Importar XML
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <SmartGrid<entradaService.NfEntradaListItem>
        gridId={GRID_ID}
        data={entradas}
        columns={columns}
        defaultSort={{ key: 'data_emissao', dir: 'desc' }}
        loading={loading}
        emptyMessage="Nenhuma nota de entrada. Importe um XML ou lance manualmente."
        onRowClick={(n) => navigate(`/entrada/notas/${n.id}`)}
        onCreate={() => navigate('/entrada/notas/novo')}
        createLabel="+ Lançamento manual"
      />
    </BaseListPage>
  );
}
