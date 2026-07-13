import { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../../components/Layout';
import api from '../../services/api';
import { icons, Icon } from '../../components/icons';
import { exportRowsToCsv } from '../../utils/exportCsv';
import { formatCPFCNPJ } from '../../utils/formatters';
import {
  relatoriosService,
  type RelatorioFonte, type RelatorioPeriodo, type RelatorioVisualizacao,
  type FontesMap, type RelatorioQueryResult, type RelatorioSalvo,
} from '../../services/relatorios';
import ReportPreview from '../../components/relatorios/ReportPreview';

interface EmpresaBasica {
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
}

const FONTE_ORDEM: RelatorioFonte[] = ['financeiro', 'vendas', 'estoque', 'compras'];
const PERIODOS: { key: RelatorioPeriodo; label: string }[] = [
  { key: '7d', label: '7 dias' }, { key: '30d', label: '30 dias' },
  { key: '90d', label: '90 dias' }, { key: '12m', label: '12 meses' },
];
const VISUALIZACOES: { key: RelatorioVisualizacao; label: string }[] = [
  { key: 'tabela', label: 'Tabela' }, { key: 'barras', label: 'Barras' },
  { key: 'linha', label: 'Linha' }, { key: 'pizza', label: 'Pizza' },
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-2.5">
        <span className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center text-[10px] font-bold flex-none">{n}</span>
        {title}
      </p>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-8 rounded-control text-xs font-medium transition-colors ${
        active ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-control bg-slate-100 dark:bg-slate-800 w-fit">
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 h-7 rounded-[7px] text-xs font-semibold transition-colors ${
            value === o.key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function RelatoriosPage() {
  const [fontes, setFontes] = useState<FontesMap | null>(null);
  const [fonte, setFonte] = useState<RelatorioFonte>('financeiro');
  const [colunas, setColunas] = useState<string[]>([]);
  const [periodo, setPeriodo] = useState<RelatorioPeriodo>('30d');
  const [agrupamento, setAgrupamento] = useState<string>('nenhum');
  const [visualizacao, setVisualizacao] = useState<RelatorioVisualizacao>('tabela');

  const [result, setResult] = useState<RelatorioQueryResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState('');

  const [salvos, setSalvos] = useState<RelatorioSalvo[]>([]);
  const [nomeSalvar, setNomeSalvar] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [empresa, setEmpresa] = useState<EmpresaBasica | null>(null);

  useEffect(() => {
    relatoriosService.fontes().then(f => {
      setFontes(f);
      const cols = Object.keys(f.financeiro?.colunas ?? {});
      setColunas(cols.slice(0, 5));
    }).catch(() => setError('Erro ao carregar as fontes de dados disponíveis.'));
    relatoriosService.listSalvos().then(setSalvos).catch(() => {});
    // Cabeçalho de impressão — não há "empresa/filial ativa" no sistema
    // (tenant pode ter várias); usa a primeira empresa cadastrada.
    api.get('/tenant/info/empresas').then(r => setEmpresa(r.data?.empresas?.[0] ?? null)).catch(() => {});
  }, []);

  const fonteInfo = fontes?.[fonte] ?? null;

  const handleTrocarFonte = (f: RelatorioFonte) => {
    setFonte(f);
    setAgrupamento('nenhum');
    const cols = Object.keys(fontes?.[f]?.colunas ?? {});
    setColunas(cols.slice(0, 5));
  };

  const toggleColuna = (key: string) => {
    setColunas(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // Barras/linha/pizza só fazem sentido com agrupamento — se o usuário escolher
  // um gráfico sem ter agrupado, seleciona automaticamente a 1ª coluna agrupável
  // em vez de silenciosamente continuar mostrando a tabela.
  const handleVisualizacaoChange = (v: RelatorioVisualizacao) => {
    setVisualizacao(v);
    if (v !== 'tabela' && agrupamento === 'nenhum') {
      const primeiraAgrupavel = fonteInfo?.groupable[0];
      if (primeiraAgrupavel) setAgrupamento(primeiraAgrupavel);
    }
  };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runQuery = useCallback(() => {
    if (!fonteInfo || colunas.length === 0) { setResult(null); return; }
    setLoadingPreview(true);
    setError('');
    relatoriosService.query({ fonte, colunas, periodo, agrupamento, visualizacao })
      .then(setResult)
      .catch(() => setError('Erro ao gerar a prévia do relatório.'))
      .finally(() => setLoadingPreview(false));
  }, [fonte, colunas, periodo, agrupamento, visualizacao, fonteInfo]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runQuery, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [runQuery]);

  const tituloGerado = fonteInfo
    ? `${fonteInfo.label}${agrupamento !== 'nenhum' ? ` por ${fonteInfo.colunas[agrupamento]?.label ?? agrupamento}` : ''}`
    : 'Relatório';

  const handleSalvar = async () => {
    if (!nomeSalvar.trim()) return;
    setSalvando(true);
    try {
      await relatoriosService.salvar(nomeSalvar.trim(), { fonte, colunas, periodo, agrupamento, visualizacao });
      setNomeSalvar('');
      setSalvos(await relatoriosService.listSalvos());
    } catch {
      setError('Erro ao salvar o relatório.');
    } finally {
      setSalvando(false);
    }
  };

  const handleAbrirSalvo = (r: RelatorioSalvo) => {
    setFonte(r.config.fonte);
    setColunas(r.config.colunas);
    setPeriodo(r.config.periodo);
    setAgrupamento(r.config.agrupamento ?? 'nenhum');
    setVisualizacao(r.config.visualizacao);
  };

  const handleRemoverSalvo = async (id: string) => {
    await relatoriosService.remover(id);
    setSalvos(await relatoriosService.listSalvos());
  };

  const handleExportarCsv = () => {
    if (!result) return;
    if (result.agrupado) {
      exportRowsToCsv('relatorio', [
        { label: 'Grupo', value: (r: Record<string, unknown>) => r.grupo },
        { label: 'Registros', value: (r: Record<string, unknown>) => r.registros },
        { label: 'Total', value: (r: Record<string, unknown>) => r.total ?? '' },
      ], result.linhas);
    } else {
      exportRowsToCsv('relatorio', colunas.map(k => ({ label: fonteInfo?.colunas[k]?.label ?? k, value: (r: Record<string, unknown>) => r[k] })), result.linhas);
    }
  };

  const nomeEmpresa = empresa?.nome_fantasia || empresa?.razao_social || '';
  const agora = new Date();
  const dataHoraGerado = agora.toLocaleDateString('pt-BR') + ' ' + agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <Layout>
      {/* Conteúdo interativo — some na impressão, ver bloco .print-only abaixo */}
      <div className="space-y-5 animate-fade-up print:hidden">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-slate-100">Relatórios</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Construtor dinâmico — monte, salve e exporte relatórios sob medida.</p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-card border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
          {/* Painel de configuração */}
          <div className="card p-5 space-y-6">
            <Step n={1} title="Fonte de dados">
              <div className="flex flex-wrap gap-2">
                {FONTE_ORDEM.map(f => (
                  <Chip key={f} active={fonte === f} onClick={() => handleTrocarFonte(f)}>{fontes?.[f]?.label ?? f}</Chip>
                ))}
              </div>
            </Step>

            <Step n={2} title="Colunas">
              <div className="flex flex-wrap gap-2">
                {Object.entries(fonteInfo?.colunas ?? {}).map(([key, col]) => (
                  <Chip key={key} active={colunas.includes(key)} onClick={() => toggleColuna(key)}>{col.label}</Chip>
                ))}
              </div>
            </Step>

            <Step n={3} title="Período">
              <Segmented options={PERIODOS} value={periodo} onChange={setPeriodo} />
            </Step>

            <Step n={4} title="Agrupar por">
              <div className="flex flex-wrap gap-2">
                <Chip active={agrupamento === 'nenhum'} onClick={() => setAgrupamento('nenhum')}>Sem agrupamento</Chip>
                {(fonteInfo?.groupable ?? []).map(key => (
                  <Chip key={key} active={agrupamento === key} onClick={() => setAgrupamento(key)}>{fonteInfo?.colunas[key]?.label ?? key}</Chip>
                ))}
              </div>
            </Step>

            <Step n={5} title="Visualização">
              <Segmented options={VISUALIZACOES} value={visualizacao} onChange={handleVisualizacaoChange} />
            </Step>
          </div>

          {/* Preview */}
          <div className="space-y-5">
            <div className="card p-5">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-display text-slate-900 dark:text-slate-100">{tituloGerado}</h2>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 tracking-wide">
                      PRÉVIA AO VIVO
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                    {result ? `${result.meta.registros} registro(s) · ${PERIODOS.find(p => p.key === periodo)?.label}` : '—'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => window.print()} className="btn-secondary" disabled={!result}>
                    <Icon d={icons.download} className="w-4 h-4" /> Exportar PDF
                  </button>
                  <button onClick={handleExportarCsv} className="btn-primary" disabled={!result}>
                    <Icon d={icons.download} className="w-4 h-4" /> Exportar CSV
                  </button>
                </div>
              </div>

              {loadingPreview ? (
                <div className="h-40 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-lg" />
              ) : (
                <ReportPreview result={result} visualizacao={visualizacao} fonteInfo={fonteInfo} colunas={colunas} />
              )}
            </div>

            {/* Relatórios salvos */}
            <div className="card p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-3">Relatórios salvos</p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={nomeSalvar}
                  onChange={e => setNomeSalvar(e.target.value)}
                  placeholder="Nome do relatório…"
                  className="input flex-1"
                />
                <button onClick={handleSalvar} disabled={salvando || !nomeSalvar.trim()} className="btn-secondary">
                  Salvar configuração
                </button>
              </div>
              {salvos.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500">Nenhum relatório salvo ainda.</p>
              ) : (
                <ul className="space-y-1.5">
                  {salvos.map(r => (
                    <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-control border border-slate-200 dark:border-slate-800 hover:border-brand-300 dark:hover:border-brand-700 transition-colors">
                      <button onClick={() => handleAbrirSalvo(r)} className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.nome}</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                          {fontes?.[r.config.fonte]?.label ?? r.config.fonte} · {PERIODOS.find(p => p.key === r.config.periodo)?.label}
                        </p>
                      </button>
                      <button onClick={() => handleRemoverSalvo(r.id)} className="text-slate-400 hover:text-red-500 flex-none p-1" title="Remover">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo exclusivo de impressão (Exportar PDF via window.print) —
          cabeçalho da empresa + título + filtros aplicados, sem o chrome
          do app (sidebar/topbar/ações). Nota: navegadores não suportam
          cabeçalho/rodapé repetido em CSS por página impressa sem uma lib
          de PDF dedicada — aparecem uma vez, no topo/fim do conteúdo. */}
      <div className="hidden print:block text-black">
        <header className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
          <div>
            <p className="font-bold text-base">{nomeEmpresa || 'SISCR'}</p>
            {empresa?.cnpj && <p className="text-xs">CNPJ {formatCPFCNPJ(empresa.cnpj)}</p>}
          </div>
          <p className="text-xs">Emitido em {dataHoraGerado}</p>
        </header>

        <h1 className="text-xl font-bold mb-1">{tituloGerado}</h1>
        <p className="text-xs mb-4">
          Fonte: {fonteInfo?.label ?? fonte} · Período: {PERIODOS.find(p => p.key === periodo)?.label}
          {colunas.length > 0 && !result?.agrupado && ` · Colunas: ${colunas.map(k => fonteInfo?.colunas[k]?.label ?? k).join(', ')}`}
          {agrupamento !== 'nenhum' && ` · Agrupado por: ${fonteInfo?.colunas[agrupamento]?.label ?? agrupamento}`}
          {' · Visualização: '}{VISUALIZACOES.find(v => v.key === visualizacao)?.label}
        </p>

        <ReportPreview result={result} visualizacao={visualizacao} fonteInfo={fonteInfo} colunas={colunas} />

        <footer className="mt-8 pt-3 border-t border-black text-[10px] flex items-center justify-between">
          <span>{nomeEmpresa || 'SISCR'}</span>
          <span>{dataHoraGerado}</span>
        </footer>
      </div>
    </Layout>
  );
}
