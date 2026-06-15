/**
 * lancamentosAutomaticos.ts
 *
 * Gera lançamentos contábeis em partida dobrada a partir de eventos do sistema:
 *   - NF-e saída emitida (venda)
 *   - NF-e entrada importada (compra)
 *   - Contas a Receber — pagamento recebido
 *   - Contas a Pagar — pagamento efetuado
 *
 * Usa o plano de contas por CÓDIGO (não por ID) para ser robusto mesmo após
 * re-importação de contas. A resolução código → id é feita em tempo de execução.
 *
 * Padrão de contas usadas (conforme planoPadrao.ts):
 *   Clientes          1.1.02.001
 *   Banco             1.1.01.002
 *   Fornecedores      2.1.01.001
 *   Receita Vendas    4.1.01.001
 *   Receita Serviços  4.1.02.001
 *   CMV               5.1.01.001
 *   Custo Serviços    5.1.02.001
 *   Desp. Diversas    6.1.07.001
 */

import type { D1Database } from '@cloudflare/workers-types'

type DB = D1Database

// ── Helpers ──────────────────────────────────────────────────────────────────

async function contaIdPorCodigo(db: DB, tenantId: string, codigo: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT id FROM plano_contas WHERE tenant_id = ? AND codigo = ? AND ativo = 1 LIMIT 1')
    .bind(tenantId, codigo)
    .first<{ id: string }>()
  return row?.id ?? null
}

async function proximoNumero(db: DB, tenantId: string, empresaId: string | null, ano: number): Promise<number> {
  const anoStr = String(ano)
  const row = await db
    .prepare(`
      SELECT MAX(numero) as max FROM lancamentos_contabeis
      WHERE tenant_id = ? AND (empresa_id = ? OR empresa_id IS NULL)
        AND substr(data_lancamento, 1, 4) = ?
    `)
    .bind(tenantId, empresaId ?? null, anoStr)
    .first<{ max: number | null }>()
  return (row?.max ?? 0) + 1
}

async function inserirLancamento(
  db: DB,
  {
    tenantId,
    empresaId,
    data,
    historico,
    origemTipo,
    origemId,
    partidas, // Array de { contaCodigo, debito, credito }
  }: {
    tenantId: string
    empresaId: string | null
    data: string
    historico: string
    origemTipo: string
    origemId: string
    partidas: Array<{ contaCodigo: string; debito: number; credito: number }>
  }
): Promise<string | null> {
  // Verifica se já existe lançamento para esta origem (idempotência)
  const existe = await db
    .prepare('SELECT id FROM lancamentos_contabeis WHERE origem_tipo = ? AND origem_id = ? AND tenant_id = ? AND status = ? LIMIT 1')
    .bind(origemTipo, origemId, tenantId, 'ativo')
    .first<{ id: string }>()
  if (existe) return existe.id

  // Resolve contas
  const itens: Array<{ contaId: string; debito: number; credito: number }> = []
  for (const p of partidas) {
    const contaId = await contaIdPorCodigo(db, tenantId, p.contaCodigo)
    if (!contaId) {
      console.warn(`[contabilidade] Conta não encontrada: ${p.contaCodigo} (tenant ${tenantId}) — lançamento omitido`)
      return null
    }
    itens.push({ contaId, debito: p.debito, credito: p.credito })
  }

  const lcId = crypto.randomUUID()
  const now = new Date().toISOString()
  const ano = new Date(data).getFullYear()
  const numero = await proximoNumero(db, tenantId, empresaId, ano)

  await db
    .prepare(`
      INSERT INTO lancamentos_contabeis
        (id, tenant_id, empresa_id, numero, data_lancamento, historico, origem_tipo, origem_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ativo', ?)
    `)
    .bind(lcId, tenantId, empresaId ?? null, numero, data, historico, origemTipo, origemId, now)
    .run()

  for (const item of itens) {
    await db
      .prepare(`
        INSERT INTO lancamentos_contabeis_itens
          (id, tenant_id, lancamento_id, conta_id, debito, credito, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(crypto.randomUUID(), tenantId, lcId, item.contaId, item.debito, item.credito, now)
      .run()
  }

  return lcId
}

// ── Verificação de plano de contas ───────────────────────────────────────────

/** Retorna true se o tenant já tem plano de contas configurado */
export async function temPlanoDeContas(db: DB, tenantId: string): Promise<boolean> {
  const row = await db
    .prepare('SELECT COUNT(*) as c FROM plano_contas WHERE tenant_id = ? AND ativo = 1')
    .bind(tenantId)
    .first<{ c: number }>()
  return (row?.c ?? 0) > 0
}

// ── Eventos ──────────────────────────────────────────────────────────────────

/**
 * NF-e saída emitida (venda de mercadorias ou serviços)
 *
 * D: 1.1.02.001 Clientes               valor_total
 * C: 4.1.01.001 Receita Vendas         (se mercadorias)
 *    4.1.02.001 Receita Serviços       (se serviços / NFS-e)
 */
export async function lcNFeSaida(
  db: DB,
  {
    tenantId, empresaId, nfeId, dataEmissao, valorTotal, tipo,
  }: {
    tenantId: string
    empresaId: string | null
    nfeId: string
    dataEmissao: string
    valorTotal: number
    tipo: 'nfe' | 'nfse'
  }
): Promise<void> {
  if (!(await temPlanoDeContas(db, tenantId))) return
  const contaReceita = tipo === 'nfse' ? '4.1.02.001' : '4.1.01.001'
  const descTipo = tipo === 'nfse' ? 'Prestação de Serviços' : 'Venda de Mercadorias'
  await inserirLancamento(db, {
    tenantId, empresaId,
    data: dataEmissao,
    historico: `${descTipo} — NF-e emitida`,
    origemTipo: 'nfe_saida',
    origemId: nfeId,
    partidas: [
      { contaCodigo: '1.1.02.001', debito: valorTotal, credito: 0 },
      { contaCodigo: contaReceita, debito: 0, credito: valorTotal },
    ],
  })
}

/**
 * NF-e entrada importada (compra de mercadorias ou serviços)
 *
 * D: 5.1.01.001 CMV / 5.1.02.001 Custo Serviços   valor_total
 * C: 2.1.01.001 Fornecedores                        valor_total
 */
export async function lcNFeEntrada(
  db: DB,
  {
    tenantId, empresaId, nfeId, dataEmissao, valorTotal, tipo,
  }: {
    tenantId: string
    empresaId: string | null
    nfeId: string
    dataEmissao: string
    valorTotal: number
    tipo: 'nfe' | 'nfse'
  }
): Promise<void> {
  if (!(await temPlanoDeContas(db, tenantId))) return
  const contaCusto = tipo === 'nfse' ? '5.1.02.001' : '5.1.01.001'
  const descTipo = tipo === 'nfse' ? 'Serviços tomados' : 'Compra de mercadorias'
  await inserirLancamento(db, {
    tenantId, empresaId,
    data: dataEmissao,
    historico: `${descTipo} — NF-e entrada`,
    origemTipo: 'nfe_entrada',
    origemId: nfeId,
    partidas: [
      { contaCodigo: contaCusto, debito: valorTotal, credito: 0 },
      { contaCodigo: '2.1.01.001', debito: 0, credito: valorTotal },
    ],
  })
}

/**
 * Conta a Receber — pagamento recebido
 *
 * D: 1.1.01.002 Banco Conta Corrente   valor_pago
 * C: 1.1.02.001 Clientes               valor_pago
 */
export async function lcCRPagamento(
  db: DB,
  {
    tenantId, empresaId, crId, dataPagamento, valorPago,
  }: {
    tenantId: string
    empresaId: string | null
    crId: string
    dataPagamento: string
    valorPago: number
  }
): Promise<void> {
  if (!(await temPlanoDeContas(db, tenantId))) return
  await inserirLancamento(db, {
    tenantId, empresaId,
    data: dataPagamento,
    historico: 'Recebimento de cliente',
    origemTipo: 'cr_pagamento',
    origemId: crId,
    partidas: [
      { contaCodigo: '1.1.01.002', debito: valorPago, credito: 0 },
      { contaCodigo: '1.1.02.001', debito: 0, credito: valorPago },
    ],
  })
}

/**
 * Conta a Pagar — pagamento efetuado
 *
 * D: 2.1.01.001 Fornecedores           valor_pago
 * C: 1.1.01.002 Banco Conta Corrente   valor_pago
 */
export async function lcCPPagamento(
  db: DB,
  {
    tenantId, empresaId, cpId, dataPagamento, valorPago,
  }: {
    tenantId: string
    empresaId: string | null
    cpId: string
    dataPagamento: string
    valorPago: number
  }
): Promise<void> {
  if (!(await temPlanoDeContas(db, tenantId))) return
  await inserirLancamento(db, {
    tenantId, empresaId,
    data: dataPagamento,
    historico: 'Pagamento a fornecedor',
    origemTipo: 'cp_pagamento',
    origemId: cpId,
    partidas: [
      { contaCodigo: '2.1.01.001', debito: valorPago, credito: 0 },
      { contaCodigo: '1.1.01.002', debito: 0, credito: valorPago },
    ],
  })
}
