/**
 * Gerador de arquivo ECD (Escrituração Contábil Digital / SPED Contábil)
 *
 * Formato: texto plano, linhas "|REGISTRO|campo1|campo2|...|"
 * Baseado no Guia Prático ECD versão 10.0.5 (Receita Federal)
 *
 * Blocos gerados:
 *   0 — Abertura e identificação do arquivo
 *   I — Lançamentos e plano de contas
 *   J — Demonstrações contábeis (BP, DRE)
 *   9 — Encerramento
 *
 * Uso:
 *   const txt = await gerarEcd(db, { tenantId, empresaId, ano: 2025 })
 *   return new Response(txt, { headers: { 'Content-Disposition': 'attachment; filename="ECD_2025.txt"' } })
 */

import type { D1Database } from '@cloudflare/workers-types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function reg(...fields: (string | number | null | undefined)[]): string {
  return '|' + fields.map(f => f == null ? '' : String(f)).join('|') + '|\n'
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function fmtData(iso: string) {
  // "YYYY-MM-DD" → "DDMMAAAA"
  if (!iso || iso.length < 10) return ''
  return iso.slice(8, 10) + iso.slice(5, 7) + iso.slice(0, 4)
}

function fmtValor(v: number): string {
  return v.toFixed(2).replace('.', ',')
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

type Empresa = {
  cnpj: string
  razao_social: string
  uf: string
  municipio_ibge?: string
  inscricao_estadual?: string
  regime_tributario?: string
}

type Conta = {
  id: string
  codigo: string
  descricao: string
  tipo: string
  natureza: string
  nivel: number
  aceita_lancamento: number
  conta_pai_id: string | null
}

type LancamentoItem = {
  lancamento_id: string
  numero: number
  data_lancamento: string
  historico: string
  conta_codigo: string
  debito: number
  credito: number
}

// ─── Gerador principal ───────────────────────────────────────────────────────

export async function gerarEcd(
  db: D1Database,
  { tenantId, empresaId, ano }: { tenantId: string; empresaId: string; ano: number }
): Promise<string> {
  const dtInicio = `${ano}-01-01`
  const dtFim = `${ano}-12-31`

  // ── Buscar empresa
  const empresa = await db
    .prepare('SELECT * FROM empresas WHERE id = ? AND tenant_id = ? LIMIT 1')
    .bind(empresaId, tenantId)
    .first<Empresa>()

  if (!empresa) throw new Error('Empresa não encontrada')

  // ── Buscar plano de contas
  const { results: contas } = await db
    .prepare('SELECT * FROM plano_contas WHERE tenant_id = ? AND (empresa_id = ? OR empresa_id IS NULL) AND ativo = 1 ORDER BY codigo')
    .bind(tenantId, empresaId)
    .all<Conta>()

  // ── Buscar lançamentos do período
  const { results: lancItens } = await db
    .prepare(`
      SELECT
        lc.id as lancamento_id,
        lc.numero,
        lc.data_lancamento,
        lc.historico,
        pc.codigo as conta_codigo,
        COALESCE(lci.debito, 0) as debito,
        COALESCE(lci.credito, 0) as credito
      FROM lancamentos_contabeis lc
      JOIN lancamentos_contabeis_itens lci ON lci.lancamento_id = lc.id
      JOIN plano_contas pc ON pc.id = lci.conta_id
      WHERE lc.tenant_id = ?
        AND (lc.empresa_id = ? OR lc.empresa_id IS NULL)
        AND lc.data_lancamento >= ?
        AND lc.data_lancamento <= ?
        AND lc.status = 'ativo'
      ORDER BY lc.data_lancamento, lc.numero
    `)
    .bind(tenantId, empresaId, dtInicio, dtFim)
    .all<LancamentoItem>()

  // ── Calcular saldos por conta para Balanço e DRE
  const saldos = new Map<string, { debito: number; credito: number }>()
  for (const c of contas) {
    saldos.set(c.codigo, { debito: 0, credito: 0 })
  }
  for (const item of lancItens) {
    const s = saldos.get(item.conta_codigo) ?? { debito: 0, credito: 0 }
    s.debito += item.debito
    s.credito += item.credito
    saldos.set(item.conta_codigo, s)
  }

  const cnpjNum = (empresa.cnpj ?? '').replace(/\D/g, '')
  const now = new Date()
  const dtGeracao = fmtData(now.toISOString().slice(0, 10))
  const horaGeracao = `${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`

  let out = ''

  // ── BLOCO 0 ──────────────────────────────────────────────────────────────
  out += reg('0000',
    'LECD',
    '10.0.5',         // versão leiaute
    '1',              // tipo escrituração: G = livro diário, 1 = livro balancetes diários + razão auxiliar
    cnpjNum,
    empresa.razao_social,
    fmtData(dtInicio),
    fmtData(dtFim),
    '',               // nome do empresário (PF, deixar vazio para PJ)
    '0',              // indica situação especial: 0 = normal
    '0',              // escrituração centralizada: 0 = não é
    '0',              // plano referenciado: 0 = não adota
    dtGeracao,
    horaGeracao,
    '1',              // situação especial início período: 0 = normal
    '0',              // obrigatoriedade: 0 = obrigatório
  )

  out += reg('0001', '0')  // abertura bloco 0

  out += reg('0007',
    cnpjNum,
    '',                         // nire
    empresa.uf ?? '',
    empresa.municipio_ibge ?? '0000000',
    empresa.inscricao_estadual ?? '',
    '',                         // im (inscrição municipal)
    '',                         // nire entidade
    '0',                        // indica leiaute adotado (0 = padrão)
  )

  // Participante: própria empresa (obrigatório no 0150)
  out += reg('0150',
    '0001',           // código do participante
    empresa.razao_social,
    'PJ',
    cnpjNum,
    '',               // cpf
    empresa.inscricao_estadual ?? '',
    '',               // im
    empresa.uf ?? '',
    empresa.municipio_ibge ?? '0000000',
    '',               // logradouro
    '',               // numero
    '',               // complemento
    '',               // bairro
    '',               // cep
    '',               // pais
  )

  out += reg('0990', String(out.split('\n').filter(l => l.trim()).length + 1))

  // ── BLOCO I ──────────────────────────────────────────────────────────────
  out += reg('I001', '0')  // abertura bloco I

  // I010 — Identificação do plano de contas
  out += reg('I010',
    'G',      // tipo: G = sintético, A = analítico — mas usamos G (agrupador)
    '0001',   // código do participante
  )

  // I012 — Relação de contas do plano
  for (const conta of contas) {
    const saldo = saldos.get(conta.codigo) ?? { debito: 0, credito: 0 }
    const saldoFinal = saldo.debito - saldo.credito
    const indSaldo = conta.natureza === 'devedora'
      ? (saldoFinal >= 0 ? 'D' : 'C')
      : (saldoFinal <= 0 ? 'C' : 'D')
    const vlSaldo = Math.abs(saldoFinal)

    out += reg('I012',
      conta.codigo,               // CÓD_CTA_REF — usa o próprio código como referência
      conta.codigo,               // CÓD_CTA
      conta.descricao,
      conta.codigo.split('.').length === 1 ? 'S' : (conta.aceita_lancamento ? 'A' : 'S'),  // S=sintética, A=analítica
      conta.natureza === 'devedora' ? 'D' : 'C',
      '',                         // nível (vazio = calcula pelo código)
      fmtValor(0),                // saldo inicial (simplificado: 0 no primeiro período)
      '',                         // ind_dc saldo inicial
      fmtValor(vlSaldo),          // saldo final
      indSaldo,                   // ind_dc saldo final
      '',                         // cod_cta_sup (conta pai) — vazio para simplificar
    )
  }

  // I030 — Abertura do período
  out += reg('I030',
    fmtData(dtInicio),
    fmtData(dtFim),
    '0001',   // participante
    '',       // ind_sit_ini: 0 = normal
    '',       // cod_sit_ini
  )

  // I050 / I100 / I150 — Lançamentos
  const lancamentosVistos = new Set<string>()
  for (const item of lancItens) {
    if (!lancamentosVistos.has(item.lancamento_id)) {
      lancamentosVistos.add(item.lancamento_id)

      // I100 — cabeçalho do lançamento
      out += reg('I100',
        fmtData(item.data_lancamento),
        fmtValor(Math.abs(item.debito || item.credito)),
        item.historico.slice(0, 200),
        '',   // cod_hist (histórico padronizado)
      )
    }

    // I150 — partida
    out += reg('I150',
      item.conta_codigo,
      item.debito > 0 ? 'D' : 'C',
      fmtValor(item.debito > 0 ? item.debito : item.credito),
      '',     // cod_cta_part (contrapartida, opcional)
      '',     // cod_ccus (centro de custo)
      '',     // cod_hist
      item.historico.slice(0, 200),
    )
  }

  const iQtd = out.split('\n').filter(l => l.trim()).length
  out += reg('I990', String(iQtd + 1))

  // ── BLOCO J — Demonstrações ───────────────────────────────────────────────
  out += reg('J001', '0')

  // J005 — Período e identificação
  out += reg('J005',
    fmtData(dtInicio),
    fmtData(dtFim),
    empresa.razao_social,
    cnpjNum,
  )

  // J100 — Balanço Patrimonial (uma linha por conta sintética nível 1-3)
  const contasBP = contas.filter(c => ['ativo', 'passivo', 'pl'].includes(c.tipo))
  for (const conta of contasBP) {
    const saldo = saldos.get(conta.codigo) ?? { debito: 0, credito: 0 }
    const vlSaldo = saldo.debito - saldo.credito
    const ind = conta.natureza === 'devedora'
      ? (vlSaldo >= 0 ? 'D' : 'C')
      : (vlSaldo <= 0 ? 'C' : 'D')

    out += reg('J100',
      conta.codigo,
      conta.descricao,
      fmtValor(Math.abs(vlSaldo)),
      ind,
      fmtValor(0),   // saldo período anterior (simplificado)
      ind,
    )
  }

  // J150 — DRE (uma linha por conta de resultado)
  const contasDRE = contas.filter(c => ['receita', 'custo', 'despesa'].includes(c.tipo))
  for (const conta of contasDRE) {
    const saldo = saldos.get(conta.codigo) ?? { debito: 0, credito: 0 }
    const vlSaldo = saldo.credito - saldo.debito  // receitas são crédito
    const ind = vlSaldo >= 0 ? 'C' : 'D'

    out += reg('J150',
      conta.codigo,
      conta.descricao,
      fmtValor(Math.abs(vlSaldo)),
      ind,
      fmtValor(0),   // período anterior
      ind,
    )
  }

  const jQtd = out.split('\n').filter(l => l.trim()).length
  out += reg('J990', String(jQtd + 1))

  // ── BLOCO 9 — Encerramento ────────────────────────────────────────────────
  out += reg('9001', '0')

  out += reg('9900', '0000', '1')
  out += reg('9900', '0001', '1')
  out += reg('9900', '0007', '1')
  out += reg('9900', '0150', '1')
  out += reg('9900', '0990', '1')
  out += reg('9900', 'I001', '1')
  out += reg('9900', 'I012', String(contas.length))
  out += reg('9900', 'I030', '1')
  out += reg('9900', 'I100', String(lancamentosVistos.size))
  out += reg('9900', 'I150', String(lancItens.length))
  out += reg('9900', 'I990', '1')
  out += reg('9900', 'J001', '1')
  out += reg('9900', 'J100', String(contasBP.length))
  out += reg('9900', 'J150', String(contasDRE.length))
  out += reg('9900', 'J990', '1')
  out += reg('9900', '9001', '1')

  const total9900 = out.split('\n').filter(l => l.trim() && l.startsWith('|9900')).length
  out += reg('9900', '9900', String(total9900 + 1))

  const totalFinal = out.split('\n').filter(l => l.trim()).length
  out += reg('9990', String(totalFinal + 1))
  out += reg('9999', String(totalFinal + 2))

  return out
}
