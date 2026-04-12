import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as entradaService from '../../services/entradaService';
import { fmtBRL, fmtDate } from '../../utils/format';
import { useErrorNotification } from '../../context/ErrorNotificationContext';
import { PessoaBusca } from '../../components/PessoaBusca';

interface ContaPagarRef {
  id: string;
  codigo?: number;
  descricao: string;
  valor: number;
  vencimento: string;
  status: string;
}

export default function NfEntradaDetail() {
  const { id } = useParams<{ id: string }>();
  const { reportError } = useErrorNotification();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [vincBusy, setVincBusy] = useState(false);
  const [fornecedorId, setFornecedorId] = useState('');
  const [fornecedorNome, setFornecedorNome] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const d = await entradaService.getNfEntrada(id);
      setData(d);
      if (d.fornecedor_id) {
        setFornecedorId(d.fornecedor_id as string);
        setFornecedorNome((d.fornecedor_nome as string) || '');
      }
    } catch {
      reportError('Nota não encontrada.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, reportError]);

  useEffect(() => {
    load();
  }, [load]);

  const vincularFornecedor = async () => {
    if (!id || !fornecedorId) {
      reportError('Busque e selecione um fornecedor.');
      return;
    }
    setVincBusy(true);
    try {
      await entradaService.vincularFornecedor(id, fornecedorId);
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      reportError(ax.response?.data?.error || 'Erro ao vincular.');
    } finally {
      setVincBusy(false);
    }
  };

  const gerarCp = async () => {
    if (!id) return;
    setGerando(true);
    try {
      const r = await entradaService.gerarContasPagar(id, 'Fornecedores');
      window.alert(r.message);
      await load();
    } catch (e: unknown) {
      const ax = e as { response?: { data?: { error?: string } } };
      reportError(ax.response?.data?.error || 'Erro ao gerar títulos.');
    } finally {
      setGerando(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-slate-500">{loading ? 'Carregando…' : 'Registro não encontrado.'}</p>
        <Link to="/entrada/notas" className="text-brand-600 text-sm mt-4 inline-block">
          ← Voltar
        </Link>
      </div>
    );
  }

  const itens = (data.itens as entradaService.NfEntradaItem[]) || [];
  const contas = (data.contas_pagar as ContaPagarRef[]) || [];
  const temFornecedor = !!data.fornecedor_id;
  const chave = String(data.chave_acesso || '');
  const podeGerarCp = temFornecedor && contas.length === 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/entrada/notas" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
            ← NF-e de entrada
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {String(data.emitente_nome || 'Fornecedor')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            NF-e {String(data.numero ?? '—')}/{String(data.serie ?? '—')} · Emissão{' '}
            {data.data_emissao ? fmtDate(String(data.data_emissao)) : '—'}
          </p>
          <p className="text-xs text-slate-400 font-mono mt-1 break-all">Chave {chave}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtBRL(Number(data.valor_total))}</div>
          <div className="text-xs text-slate-500">Total NF-e</div>
        </div>
      </div>

      {data.assinatura_valida === 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Assinatura digital não validada ou ausente no arquivo — confira o XML antes de usar em produção.
        </div>
      )}

      {!temFornecedor && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Vincular fornecedor</h2>
          <p className="text-sm text-slate-500">
            Não encontramos cadastro de fornecedor com o CNPJ <strong>{String(data.emitente_cnpj)}</strong>. Busque abaixo ou cadastre em Pessoas.
          </p>
          <PessoaBusca
            tipoCadastro="fornecedor"
            value={fornecedorId}
            displayValue={fornecedorNome}
            onChange={(id, nome) => {
              setFornecedorId(id);
              setFornecedorNome(nome);
            }}
          />
          <button
            type="button"
            disabled={vincBusy || !fornecedorId}
            onClick={vincularFornecedor}
            className="px-4 py-2 rounded-lg bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 text-sm font-medium disabled:opacity-50"
          >
            {vincBusy ? 'Salvando…' : 'Salvar vínculo'}
          </button>
        </div>
      )}

      {podeGerarCp && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium text-emerald-900 dark:text-emerald-100">Contas a pagar</p>
            <p className="text-sm text-emerald-800/90 dark:text-emerald-200/90">
              Gera títulos a partir das duplicatas do XML (ou um único título com o total, se não houver cobrança).
            </p>
          </div>
          <button
            type="button"
            disabled={gerando}
            onClick={gerarCp}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
          >
            {gerando ? 'Gerando…' : 'Gerar contas a pagar'}
          </button>
        </div>
      )}

      {contas.length > 0 && (
        <div>
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Títulos vinculados</h2>
          <ul className="space-y-2">
            {contas.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/financeiro/contas-pagar/${c.id}`}
                  className="flex justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-200">{c.descricao}</span>
                  <span className="text-sm tabular-nums">
                    {fmtBRL(c.valor)} · {fmtDate(c.vencimento)} · {c.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Itens</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Descrição</th>
                <th className="px-3 py-2">CFOP</th>
                <th className="px-3 py-2 text-right">Qtd</th>
                <th className="px-3 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {itens.map((it, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{it.descricao}</td>
                  <td className="px-3 py-2 font-mono text-xs">{it.cfop ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{it.quantidade}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(it.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
