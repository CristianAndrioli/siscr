import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { parseListPagination } from '../lib/listPagination'
import type { NfeEntradaItem } from '../lib/nfe/parseNfeEntradaXml'
import { normalizarCnpj, parseNfeEntradaXml } from '../lib/nfe/parseNfeEntradaXml'
import { verificarAssinaturaNfeXml } from '../lib/nfe/verifyNfeSignature'
import { nextCodigo } from '../lib/nextCodigo'

const app = new Hono<{ Bindings: Env }>()

function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

/** Padrão comum: casar SKU/código do fornecedor (`cProd`) ou EAN com o cadastro. */
async function sugerirProdutoParaItem(
  db: D1Database,
  tenantId: string,
  empresaId: string,
  item: NfeEntradaItem,
): Promise<{ produtoId: string | null; motivo: 'sku' | 'codigo' | 'ean' | 'none'; rotulo?: string }> {
  const cProd = item.cProd?.trim()
  const ean = onlyDigits(item.cEAN || '')

  if (cProd) {
    const r1 = await db
      .prepare(
        `SELECT id, descricao FROM produtos
         WHERE tenant_id = ? AND (empresa_id = ? OR empresa_id IS NULL) AND sku = ?
         LIMIT 1`,
      )
      .bind(tenantId, empresaId, cProd)
      .first<{ id: string; descricao: string }>()
    if (r1) return { produtoId: r1.id, motivo: 'sku', rotulo: r1.descricao }

    const r2 = await db
      .prepare(
        `SELECT id, descricao FROM produtos
         WHERE tenant_id = ? AND (empresa_id = ? OR empresa_id IS NULL) AND codigo = ?
         LIMIT 1`,
      )
      .bind(tenantId, empresaId, cProd)
      .first<{ id: string; descricao: string }>()
    if (r2) return { produtoId: r2.id, motivo: 'codigo', rotulo: r2.descricao }
  }

  if (ean.length >= 8) {
    const r3 = await db
      .prepare(`SELECT id, descricao FROM produtos WHERE tenant_id = ? AND sku = ? LIMIT 1`)
      .bind(tenantId, ean)
      .first<{ id: string; descricao: string }>()
    if (r3) return { produtoId: r3.id, motivo: 'ean', rotulo: r3.descricao }
  }

  return { produtoId: null, motivo: 'none' }
}

async function criarProdutoDoItem(
  env: Env,
  tenantId: string,
  empresaId: string,
  item: NfeEntradaItem,
  uid: string | null,
): Promise<string> {
  const db = env.DB_SHARED
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const codigo = await nextCodigo(db, 'produtos', tenantId)
  const descricao = (item.descricao || 'Produto importado NF-e').slice(0, 500)
  const unidade = (item.unidade || 'UN').slice(0, 6)
  const preco =
    item.valorUnitario > 0
      ? item.valorUnitario
      : item.quantidade > 0
        ? item.valorTotal / item.quantidade
        : 0
  let sku: string | null = item.cProd?.trim().slice(0, 60) || null
  if (sku) {
    const clash = await db
      .prepare(`SELECT id FROM produtos WHERE tenant_id = ? AND sku = ?`)
      .bind(tenantId, sku)
      .first()
    if (clash) sku = null
  }
  const ncm = item.ncm ? onlyDigits(item.ncm).slice(0, 8) : null

  await db
    .prepare(
      `INSERT INTO produtos (id, tenant_id, empresa_id, codigo, sku, descricao, unidade, preco_venda, preco_custo, ncm,
        origem, cest, icms_cst, icms_csosn, pis_cst, cofins_cst, ativo, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, NULL, '07', '07', 1, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenantId,
      empresaId,
      codigo,
      sku,
      descricao,
      unidade,
      preco,
      preco,
      ncm || null,
      now,
      now,
      uid ?? null,
      uid ?? null,
    )
    .run()
  return id
}

async function findFornecedorPorCnpj(
  db: D1Database,
  tenantId: string,
  empresaId: string,
  cnpj: string,
): Promise<string | null> {
  const c = normalizarCnpj(cnpj)
  const row = await db
    .prepare(
      `SELECT id FROM pessoas
       WHERE tenant_id = ? AND empresa_id = ? AND tipo_cadastro = 'fornecedor'
         AND replace(replace(replace(replace(cpf_cnpj, '.', ''), '/', ''), '-', ''), ' ', '') = ?
       LIMIT 1`,
    )
    .bind(tenantId, empresaId, c)
    .first<{ id: string }>()
  return row?.id ?? null
}

/** Valida se o destinatário do XML é a empresa cadastrada (CNPJ). */
async function assertDestinatarioEhEmpresa(
  db: D1Database,
  tenantId: string,
  empresaId: string,
  destDoc: string,
  destTipo: 'CNPJ' | 'CPF',
): Promise<void> {
  if (destTipo !== 'CNPJ') {
    throw new Error('NF-e com destinatário CPF não pode ser importada como entrada de PJ (use empresa CNPJ).')
  }
  const emp = await db
    .prepare(
      `SELECT cnpj FROM empresas WHERE id = ? AND tenant_id = ?`,
    )
    .bind(empresaId, tenantId)
    .first<{ cnpj: string }>()
  if (!emp) throw new Error('Empresa não encontrada.')
  if (normalizarCnpj(emp.cnpj) !== normalizarCnpj(destDoc)) {
    throw new Error(
      'O destinatário da NF-e não corresponde ao CNPJ da empresa selecionada. Verifique o XML e a empresa/filial.',
    )
  }
}

// GET /nf-entradas
app.get('/nf-entradas', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  let where = `FROM nf_entradas n
    LEFT JOIN pessoas p ON p.id = n.fornecedor_id
    WHERE n.tenant_id = ?`
  const params: unknown[] = [tenant.tenantId]
  if (empresaId) {
    where += ' AND n.empresa_id = ?'
    params.push(empresaId)
  }
  if (filialId) {
    where += ' AND n.filial_id = ?'
    params.push(filialId)
  }

  const countRow = await c.env.DB_SHARED
    .prepare(`SELECT COUNT(*) as c ${where}`)
    .bind(...params)
    .first<{ c: number }>()
  const total = Number(countRow?.c ?? 0)

  const { results } = await c.env.DB_SHARED
    .prepare(
      `SELECT n.id, n.chave_acesso, n.emitente_cnpj, n.emitente_nome, n.data_emissao,
              n.numero, n.serie, n.valor_total, n.status, n.fornecedor_id,
              n.created_at, p.nome as fornecedor_nome
       ${where}
       ORDER BY n.data_emissao DESC, n.created_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset)
    .all()

  return c.json({ entradas: results, total, page, limit })
})

// POST /nf-entradas/preview-xml — análise sem gravar (assistente)
app.post('/nf-entradas/preview-xml', async (c) => {
  const tenant = c.get('tenant')
  let body: Record<string, unknown>
  try {
    body = (await c.req.parseBody()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'Envie multipart com file e empresaId.' }, 400)
  }
  const file = body.file
  const empresaId = typeof body.empresaId === 'string' ? body.empresaId : ''
  if (!empresaId) return c.json({ error: 'Informe empresaId.' }, 400)
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return c.json({ error: 'Envie o campo file (XML).' }, 400)
  }
  const ab = await (file as File).arrayBuffer()
  const xml = new TextDecoder('utf-8').decode(ab)
  let parsed
  try {
    parsed = parseNfeEntradaXml(xml)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }
  try {
    await assertDestinatarioEhEmpresa(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed.destinatarioDoc, parsed.destinatarioTipo)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  let assinaturaValida = false
  try {
    const v = await verificarAssinaturaNfeXml(xml)
    assinaturaValida = !!(v.valida && v.possuiAssinatura)
  } catch {
    assinaturaValida = false
  }

  const sugestoes: {
    indice: number
    produtoId: string | null
    motivo: string
    rotulo?: string
  }[] = []
  for (let i = 0; i < parsed.itens.length; i++) {
    const s = await sugerirProdutoParaItem(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed.itens[i]!)
    sugestoes.push({
      indice: i,
      produtoId: s.produtoId,
      motivo: s.motivo,
      rotulo: s.rotulo,
    })
  }

  const fornecedorId = await findFornecedorPorCnpj(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed.emitenteCnpj)

  return c.json({
    parsed,
    sugestoes,
    assinatura_valida: assinaturaValida,
    fornecedor_id: fornecedorId,
    xml_tamanho_bytes: ab.byteLength,
  })
})

const vinculoConfirmSchema = z.object({
  indice: z.number().int().min(0),
  produtoId: z.string().uuid().optional(),
  criar: z.boolean().optional(),
})

const confirmImportSchema = z.object({
  xmlBase64: z.string().min(20),
  empresaId: z.string().uuid(),
  filialId: z.string().uuid().nullable().optional(),
  vinculos: z.array(vinculoConfirmSchema).min(1),
})

// POST /nf-entradas/confirmar — grava NF-e com itens vinculados a produtos (e cria produtos quando solicitado)
app.post('/nf-entradas/confirmar', zValidator('json', confirmImportSchema), async (c) => {
  const tenant = c.get('tenant')
  if (!c.env.R2_STORAGE) {
    return c.json({ error: 'Armazenamento R2 não configurado.' }, 503)
  }
  const { xmlBase64, empresaId, filialId } = c.req.valid('json')
  const vinculosIn = c.req.valid('json').vinculos
  const uid = auditUserId(c)

  let xml: string
  try {
    const bytes = Uint8Array.from(atob(xmlBase64), (ch) => ch.charCodeAt(0))
    xml = new TextDecoder('utf-8').decode(bytes)
  } catch {
    return c.json({ error: 'xmlBase64 inválido.' }, 400)
  }

  let parsed
  try {
    parsed = parseNfeEntradaXml(xml)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  try {
    await assertDestinatarioEhEmpresa(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed.destinatarioDoc, parsed.destinatarioTipo)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  const nItens = parsed.itens.length
  if (nItens === 0) {
    return c.json({ error: 'NF-e sem itens de produto.' }, 400)
  }

  const byIdx = new Map(vinculosIn.map((v) => [v.indice, v]))
  for (let i = 0; i < nItens; i++) {
    if (!byIdx.has(i)) {
      return c.json({ error: `Falta vínculo para o item índice ${i}.` }, 400)
    }
  }
  for (const v of vinculosIn) {
    const hasPid = Boolean(v.produtoId)
    const criar = v.criar === true
    if (hasPid && criar) {
      return c.json({ error: `Item ${v.indice}: use produtoId ou criar=true, não ambos.` }, 400)
    }
    if (!hasPid && !criar) {
      return c.json({ error: `Item ${v.indice}: vincule um produto ou marque criação automática.` }, 400)
    }
  }

  const dup = await c.env.DB_SHARED
    .prepare(`SELECT id FROM nf_entradas WHERE tenant_id = ? AND chave_acesso = ?`)
    .bind(tenant.tenantId, parsed.chaveAcesso)
    .first<{ id: string }>()
  if (dup) {
    return c.json({ error: 'Esta NF-e já foi importada.', id: dup.id }, 409)
  }

  const itensOut: Record<string, unknown>[] = []
  for (let i = 0; i < nItens; i++) {
    const v = byIdx.get(i)!
    const base = parsed.itens[i]!
    let produtoId: string
    if (v.criar) {
      produtoId = await criarProdutoDoItem(c.env, tenant.tenantId, empresaId, base, uid)
      itensOut.push({
        ...base,
        produto_id: produtoId,
        criado_no_import: true,
      })
    } else {
      const chk = await c.env.DB_SHARED
        .prepare(`SELECT id FROM produtos WHERE id = ? AND tenant_id = ?`)
        .bind(v.produtoId!, tenant.tenantId)
        .first<{ id: string }>()
      if (!chk) {
        return c.json({ error: `Produto ${v.produtoId} não encontrado.` }, 400)
      }
      produtoId = v.produtoId!
      itensOut.push({
        ...base,
        produto_id: produtoId,
        criado_no_import: false,
      })
    }
  }

  let assinaturaValida = false
  try {
    const ver = await verificarAssinaturaNfeXml(xml)
    assinaturaValida = !!(ver.valida && ver.possuiAssinatura)
  } catch {
    assinaturaValida = false
  }

  const fornecedorId = await findFornecedorPorCnpj(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed.emitenteCnpj)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const xmlPath = `tenants/${tenant.tenantId}/nfe_entrada/${parsed.chaveAcesso}.xml`
  const ab = new TextEncoder().encode(xml)

  await c.env.R2_STORAGE.put(xmlPath, ab, {
    httpMetadata: { contentType: 'application/xml' },
  })

  await c.env.DB_SHARED
    .prepare(
      `INSERT INTO nf_entradas
        (id, tenant_id, empresa_id, filial_id, chave_acesso, xml_path, emitente_cnpj, emitente_nome,
         destinatario_cnpj, data_emissao, numero, serie, natureza_operacao, valor_total, valor_produtos,
         fornecedor_id, itens_json, cobranca_json, assinatura_valida, status, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'importada', ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenant.tenantId,
      empresaId,
      filialId ?? null,
      parsed.chaveAcesso,
      xmlPath,
      parsed.emitenteCnpj,
      parsed.emitenteNome || null,
      parsed.destinatarioDoc,
      parsed.dataEmissao,
      parsed.numero,
      parsed.serie,
      parsed.naturezaOperacao || null,
      parsed.valorTotal,
      parsed.valorProdutos,
      fornecedorId,
      JSON.stringify(itensOut),
      JSON.stringify(parsed.duplicatas),
      assinaturaValida ? 1 : 0,
      now,
      now,
      uid,
      uid,
    )
    .run()

  return c.json(
    {
      id,
      message: 'NF-e importada com vínculo de produtos.',
      fornecedor_vinculado: !!fornecedorId,
      assinatura_valida: assinaturaValida,
    },
    201,
  )
})

// GET /nf-entradas/:id
app.get('/nf-entradas/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const row = await c.env.DB_SHARED
    .prepare(
      `SELECT n.*, p.nome as fornecedor_nome, p.cpf_cnpj as fornecedor_doc
       FROM nf_entradas n
       LEFT JOIN pessoas p ON p.id = n.fornecedor_id
       WHERE n.id = ? AND n.tenant_id = ?`,
    )
    .bind(id, tenant.tenantId)
    .first<Record<string, unknown>>()

  if (!row) return c.json({ error: 'Nota de entrada não encontrada.' }, 404)

  const contas = await c.env.DB_SHARED
    .prepare(
      `SELECT id, codigo, descricao, valor, vencimento, status, nf_entrada_id
       FROM contas_pagar WHERE tenant_id = ? AND nf_entrada_id = ? ORDER BY vencimento`,
    )
    .bind(tenant.tenantId, id)
    .all()

  let itens: unknown[] = []
  try {
    if (row.itens_json && typeof row.itens_json === 'string') {
      itens = JSON.parse(row.itens_json as string) as unknown[]
    }
  } catch {
    itens = []
  }

  let cobranca: unknown = null
  try {
    if (row.cobranca_json && typeof row.cobranca_json === 'string') {
      cobranca = JSON.parse(row.cobranca_json as string)
    }
  } catch {
    cobranca = null
  }

  return c.json({ ...row, itens, cobranca, contas_pagar: contas.results ?? [] })
})

// POST /nf-entradas/importar-xml  (multipart: file + empresaId + filialId opcional)
app.post('/nf-entradas/importar-xml', async (c) => {
  const tenant = c.get('tenant')
  if (!c.env.R2_STORAGE) {
    return c.json({ error: 'Armazenamento R2 não configurado.' }, 503)
  }

  let body: Record<string, unknown>
  try {
    body = (await c.req.parseBody()) as Record<string, unknown>
  } catch {
    return c.json({ error: 'Corpo inválido. Envie multipart com arquivo XML.' }, 400)
  }

  const file = body.file
  const empresaId = typeof body.empresaId === 'string' ? body.empresaId : ''
  const filialId = typeof body.filialId === 'string' && body.filialId ? body.filialId : null

  if (!empresaId) return c.json({ error: 'Informe empresaId.' }, 400)
  if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
    return c.json({ error: 'Envie o campo file (XML da NF-e).' }, 400)
  }

  const ab = await (file as File).arrayBuffer()
  const xml = new TextDecoder('utf-8').decode(ab)
  let parsed
  try {
    parsed = parseNfeEntradaXml(xml)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  try {
    await assertDestinatarioEhEmpresa(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed.destinatarioDoc, parsed.destinatarioTipo)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return c.json({ error: msg }, 400)
  }

  const dup = await c.env.DB_SHARED
    .prepare(`SELECT id FROM nf_entradas WHERE tenant_id = ? AND chave_acesso = ?`)
    .bind(tenant.tenantId, parsed.chaveAcesso)
    .first<{ id: string }>()
  if (dup) {
    return c.json({ error: 'Esta NF-e já foi importada (chave duplicada).', id: dup.id }, 409)
  }

  let assinaturaValida = false
  try {
    const v = await verificarAssinaturaNfeXml(xml)
    assinaturaValida = !!(v.valida && v.possuiAssinatura)
  } catch {
    assinaturaValida = false
  }

  const fornecedorId = await findFornecedorPorCnpj(c.env.DB_SHARED, tenant.tenantId, empresaId, parsed.emitenteCnpj)

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const xmlPath = `tenants/${tenant.tenantId}/nfe_entrada/${parsed.chaveAcesso}.xml`

  await c.env.R2_STORAGE.put(xmlPath, ab, {
    httpMetadata: { contentType: 'application/xml' },
  })

  const cobrancaJson = JSON.stringify(parsed.duplicatas)

  await c.env.DB_SHARED
    .prepare(
      `INSERT INTO nf_entradas
        (id, tenant_id, empresa_id, filial_id, chave_acesso, xml_path, emitente_cnpj, emitente_nome,
         destinatario_cnpj, data_emissao, numero, serie, natureza_operacao, valor_total, valor_produtos,
         fornecedor_id, itens_json, cobranca_json, assinatura_valida, status, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'importada', ?, ?, ?, ?)`,
    )
    .bind(
      id,
      tenant.tenantId,
      empresaId,
      filialId,
      parsed.chaveAcesso,
      xmlPath,
      parsed.emitenteCnpj,
      parsed.emitenteNome || null,
      parsed.destinatarioDoc,
      parsed.dataEmissao,
      parsed.numero,
      parsed.serie,
      parsed.naturezaOperacao || null,
      parsed.valorTotal,
      parsed.valorProdutos,
      fornecedorId,
      JSON.stringify(parsed.itens),
      cobrancaJson,
      assinaturaValida ? 1 : 0,
      now,
      now,
      uid,
      uid,
    )
    .run()

  return c.json(
    {
      id,
      message: 'NF-e importada com sucesso.',
      fornecedor_vinculado: !!fornecedorId,
      assinatura_valida: assinaturaValida,
    },
    201,
  )
})

const gerarCpSchema = z.object({
  categoria: z.string().optional(),
})

// POST /nf-entradas/:id/gerar-contas-pagar
app.post('/nf-entradas/:id/gerar-contas-pagar', zValidator('json', gerarCpSchema), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const { categoria } = c.req.valid('json')

  const ne = await c.env.DB_SHARED
    .prepare(`SELECT * FROM nf_entradas WHERE id = ? AND tenant_id = ?`)
    .bind(id, tenant.tenantId)
    .first<Record<string, unknown>>()

  if (!ne) return c.json({ error: 'Nota de entrada não encontrada.' }, 404)

  if (!ne.fornecedor_id) {
    return c.json(
      {
        error:
          'Cadastre o fornecedor com o mesmo CNPJ do emitente ou associe manualmente antes de gerar títulos.',
      },
      400,
    )
  }

  const existentes = await c.env.DB_SHARED
    .prepare(`SELECT COUNT(*) as c FROM contas_pagar WHERE tenant_id = ? AND nf_entrada_id = ?`)
    .bind(tenant.tenantId, id)
    .first<{ c: number }>()
  if (Number(existentes?.c ?? 0) > 0) {
    return c.json({ error: 'Já existem contas a pagar vinculadas a esta NF-e.' }, 409)
  }

  let duplicatas: { numero?: string; vencimento: string; valor: number }[] = []
  try {
    duplicatas = JSON.parse((ne.cobranca_json as string) || '[]') as typeof duplicatas
  } catch {
    duplicatas = []
  }

  if (!duplicatas.length) {
    const venc = (ne.data_emissao as string)?.slice(0, 10) || new Date().toISOString().slice(0, 10)
    duplicatas = [{ vencimento: venc, valor: Number(ne.valor_total) || 0 }]
  }

  const empresaId = ne.empresa_id as string
  const filialId = (ne.filial_id as string) || null
  const pessoaId = ne.fornecedor_id as string
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const nrDoc = `NFe ${ne.numero}/${ne.serie || '1'}`
  const descBase = `NF-e entrada ${ne.emitente_nome || ne.emitente_cnpj} — chave ${ne.chave_acesso}`

  const criadas: string[] = []
  const stmts: ReturnType<typeof c.env.DB_SHARED.prepare>[] = []

  for (let i = 0; i < duplicatas.length; i++) {
    const dup = duplicatas[i]!
    const cid = crypto.randomUUID()
    criadas.push(cid)
    stmts.push(
      c.env.DB_SHARED.prepare(
        `INSERT INTO contas_pagar
          (id, tenant_id, empresa_id, filial_id, pessoa_id, descricao, valor, vencimento, status,
           categoria, observacoes, nr_documento, especie, data_emissao, data_lancamento, moeda, nf_entrada_id,
           created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente', ?, ?, ?, 'DM', ?, ?, 'BRL', ?, ?, ?, ?, ?)`,
      ).bind(
        cid,
        tenant.tenantId,
        empresaId,
        filialId,
        pessoaId,
        duplicatas.length > 1 ? `${descBase} — parcela ${i + 1}` : descBase,
        dup.valor,
        dup.vencimento,
        categoria ?? 'Fornecedores',
        `Gerado automaticamente a partir da NF-e de entrada.`,
        nrDoc,
        (ne.data_emissao as string)?.slice(0, 10) || null,
        now.slice(0, 10),
        id,
        now,
        now,
        uid,
        uid,
      ),
    )
  }

  await c.env.DB_SHARED.batch(stmts)
  return c.json({ ids: criadas, message: `${criadas.length} título(s) a pagar criado(s).` }, 201)
})

const patchFornecedorSchema = z.object({
  fornecedorId: z.string().uuid(),
})

// PATCH /nf-entradas/:id — vincular fornecedor (cadastro) manualmente
app.patch('/nf-entradas/:id', zValidator('json', patchFornecedorSchema), async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const { fornecedorId } = c.req.valid('json')

  const pessoa = await c.env.DB_SHARED
    .prepare(
      `SELECT id FROM pessoas WHERE id = ? AND tenant_id = ? AND tipo_cadastro = 'fornecedor'`,
    )
    .bind(fornecedorId, tenant.tenantId)
    .first<{ id: string }>()
  if (!pessoa) {
    return c.json({ error: 'Fornecedor não encontrado ou não é cadastro de fornecedor.' }, 400)
  }

  const r = await c.env.DB_SHARED
    .prepare(
      `UPDATE nf_entradas SET fornecedor_id = ?, updated_at = ?, updated_by = ?
       WHERE id = ? AND tenant_id = ?`,
    )
    .bind(fornecedorId, new Date().toISOString(), auditUserId(c), id, tenant.tenantId)
    .run()

  const changes = (r as { meta?: { changes?: number } }).meta?.changes ?? 0
  if (changes === 0) return c.json({ error: 'Nota de entrada não encontrada.' }, 404)
  return c.json({ message: 'Fornecedor vinculado.' })
})

export default app
