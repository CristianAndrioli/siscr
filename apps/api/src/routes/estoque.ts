import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { csvAttachment, rowsToCsv } from '../lib/csv'

const app = new Hono<{ Bindings: Env }>()

// ─── Posição de Estoque ───────────────────────────────────────────

app.get('/', async (c) => {
  const tenant = c.get('tenant')
  const q = c.req.query()
  const { produtoId, location, busca } = q
  const exportFmt = q.export

  let query = `
    SELECT e.id, e.produto_id, p.descricao as produto, p.codigo as codigo,
           p.unidade, e.location, e.quantidade, e.updated_at
    FROM estoque e
    LEFT JOIN produtos p ON p.id = e.produto_id
    WHERE e.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (produtoId) { query += ' AND e.produto_id = ?'; params.push(produtoId) }
  if (location) { query += ' AND e.location = ?'; params.push(location) }
  if (busca) { query += ' AND (p.descricao LIKE ? OR p.codigo LIKE ? OR e.location LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`) }

  query += ' ORDER BY p.descricao, e.location'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()

  if (exportFmt === 'csv') {
    const cols = ['id', 'produto_id', 'produto', 'codigo', 'unidade', 'location', 'quantidade', 'updated_at']
    const rows = (results ?? []).map((r) => r as Record<string, unknown>)
    return csvAttachment(rowsToCsv(rows, cols), 'estoque.csv')
  }

  return c.json({ estoque: results })
})

// ─── Movimentações ────────────────────────────────────────────────

app.get('/movimentacoes', async (c) => {
  const tenant = c.get('tenant')
  const { produtoId, tipo, location, busca } = c.req.query()

  let query = `
    SELECT m.id, m.codigo, m.produto_id, p.descricao as produto, p.codigo as produto_codigo,
           m.tipo, m.quantidade, m.location, m.motivo, m.referencia_id, m.created_at
    FROM movimentacoes_estoque m
    LEFT JOIN produtos p ON p.id = m.produto_id
    WHERE m.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (produtoId) { query += ' AND m.produto_id = ?'; params.push(produtoId) }
  if (tipo) { query += ' AND m.tipo = ?'; params.push(tipo) }
  if (location) { query += ' AND m.location = ?'; params.push(location) }
  if (busca) { query += ' AND (p.descricao LIKE ? OR p.codigo LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  query += ' ORDER BY m.created_at DESC LIMIT 200'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ movimentacoes: results })
})

const movSchema = z.object({
  produtoId: z.string().uuid(),
  tipo: z.enum(['entrada', 'saida', 'ajuste']),
  quantidade: z.number().positive(),
  location: z.string().min(1).default('GERAL'),
  motivo: z.string().optional(),
})

app.post('/movimentacoes', zValidator('json', movSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const qtdDelta = data.tipo === 'saida' ? -data.quantidade : data.quantidade

  if (data.tipo === 'saida') {
    const row = await c.env.DB_SHARED
      .prepare('SELECT quantidade FROM estoque WHERE tenant_id = ? AND produto_id = ? AND location = ?')
      .bind(tenant.tenantId, data.produtoId, data.location)
      .first<{ quantidade: number }>()
    const disp = row?.quantidade ?? 0
    if (disp < data.quantidade) {
      return c.json(
        { error: 'Saldo insuficiente para saída.', disponivel: disp, solicitado: data.quantidade },
        400,
      )
    }
  }

  await c.env.DB_SHARED.batch([
    c.env.DB_SHARED.prepare(`
      INSERT INTO movimentacoes_estoque
        (id, tenant_id, produto_id, tipo, quantidade, location, motivo, usuario_id, created_at, created_by, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, tenant.tenantId, data.produtoId, data.tipo, data.quantidade,
        data.location, data.motivo ?? null, user?.userId ?? null, now, uid, uid, now),

    c.env.DB_SHARED.prepare(`
      INSERT INTO estoque (id, tenant_id, produto_id, location, quantidade, updated_at, created_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, produto_id, location) DO UPDATE SET
        quantidade = quantidade + ?,
        updated_at = ?,
        updated_by = ?
    `).bind(crypto.randomUUID(), tenant.tenantId, data.produtoId,
        data.location, data.quantidade, now, now, uid, uid, qtdDelta, now, uid),
  ])

  return c.json({ id, message: 'Movimentação registrada.' }, 201)
})

// ─── Transferências ───────────────────────────────────────────────

app.get('/transferencias', async (c) => {
  const tenant = c.get('tenant')
  const { busca } = c.req.query()

  let query = `
    SELECT m.id, m.produto_id, p.descricao as produto, p.codigo as codigo,
           m.quantidade, m.location as local_origem,
           m.referencia_id as local_destino,
           m.motivo, m.created_at
    FROM movimentacoes_estoque m
    LEFT JOIN produtos p ON p.id = m.produto_id
    WHERE m.tenant_id = ? AND m.tipo = 'transferencia_saida'
  `
  const params: unknown[] = [tenant.tenantId]

  if (busca) { query += ' AND (p.descricao LIKE ? OR p.codigo LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  query += ' ORDER BY m.created_at DESC LIMIT 100'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ transferencias: results })
})

const transSchema = z.object({
  produtoId: z.string().uuid(),
  localOrigem: z.string().min(1),
  localDestino: z.string().min(1),
  quantidade: z.number().positive(),
  motivo: z.string().optional(),
})

app.post('/transferencias', zValidator('json', transSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const data = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const idSaida = crypto.randomUUID()
  const idEntrada = crypto.randomUUID()

  if (data.localOrigem === data.localDestino) {
    return c.json({ error: 'Local de origem e destino devem ser diferentes.' }, 400)
  }

  // Verificar saldo suficiente
  const saldo = await c.env.DB_SHARED
    .prepare('SELECT quantidade FROM estoque WHERE tenant_id = ? AND produto_id = ? AND location = ?')
    .bind(tenant.tenantId, data.produtoId, data.localOrigem)
    .first<{ quantidade: number }>()

  if (!saldo || saldo.quantidade < data.quantidade) {
    return c.json({ error: `Saldo insuficiente no local "${data.localOrigem}". Disponível: ${saldo?.quantidade ?? 0}` }, 400)
  }

  await c.env.DB_SHARED.batch([
    // Movimentação de saída (origem)
    c.env.DB_SHARED.prepare(`
      INSERT INTO movimentacoes_estoque
        (id, tenant_id, produto_id, tipo, quantidade, location, referencia_id, motivo, usuario_id, created_at, created_by, updated_by, updated_at)
      VALUES (?, ?, ?, 'transferencia_saida', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(idSaida, tenant.tenantId, data.produtoId, data.quantidade,
        data.localOrigem, data.localDestino, data.motivo ?? null, user?.userId ?? null, now, uid, uid, now),

    // Movimentação de entrada (destino)
    c.env.DB_SHARED.prepare(`
      INSERT INTO movimentacoes_estoque
        (id, tenant_id, produto_id, tipo, quantidade, location, referencia_id, motivo, usuario_id, created_at, created_by, updated_by, updated_at)
      VALUES (?, ?, ?, 'transferencia_entrada', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(idEntrada, tenant.tenantId, data.produtoId, data.quantidade,
        data.localDestino, data.localOrigem, data.motivo ?? null, user?.userId ?? null, now, uid, uid, now),

    // Debitar estoque origem
    c.env.DB_SHARED.prepare(`
      UPDATE estoque SET quantidade = quantidade - ?, updated_at = ?, updated_by = ?
      WHERE tenant_id = ? AND produto_id = ? AND location = ?
    `).bind(data.quantidade, now, uid, tenant.tenantId, data.produtoId, data.localOrigem),

    // Creditar estoque destino (insert or update)
    c.env.DB_SHARED.prepare(`
      INSERT INTO estoque (id, tenant_id, produto_id, location, quantidade, updated_at, created_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, produto_id, location) DO UPDATE SET
        quantidade = quantidade + ?,
        updated_at = ?,
        updated_by = ?
    `).bind(crypto.randomUUID(), tenant.tenantId, data.produtoId,
        data.localDestino, data.quantidade, now, now, uid, uid, data.quantidade, now, uid),
  ])

  return c.json({ id: idSaida, message: 'Transferência realizada com sucesso.' }, 201)
})

// ─── Locais ───────────────────────────────────────────────────────

app.get('/locais', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED
    .prepare('SELECT * FROM locais WHERE tenant_id = ? ORDER BY nome')
    .bind(tenant.tenantId)
    .all()
  return c.json({ locais: results })
})

const localSchema = z.object({
  nome: z.string().min(1).max(50),
  tipo: z.enum(['GERAL', 'ALMOXARIFADO', 'LOJA', 'ARMAZEM', 'DEPOSITO', 'EXTERNO']).default('GERAL'),
  descricao: z.string().optional(),
})

app.post('/locais', zValidator('json', localSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  try {
    await c.env.DB_SHARED
      .prepare('INSERT INTO locais (id, tenant_id, nome, tipo, descricao, ativo, created_at, updated_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)')
      .bind(id, tenant.tenantId, data.nome.toUpperCase(), data.tipo, data.descricao ?? null, now, now, uid, uid)
      .run()
  } catch {
    return c.json({ error: `Já existe um local com o nome "${data.nome}".` }, 409)
  }

  return c.json({ id, message: 'Local criado com sucesso.' }, 201)
})

app.put('/locais/:id', zValidator('json', localSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const now = new Date().toISOString()

  const fieldMap: Record<string, string> = { nome: 'nome', tipo: 'tipo', descricao: 'descricao' }
  const setClauses = Object.keys(data).filter(k => k in fieldMap).map(k => `${fieldMap[k]} = ?`).join(', ')
  const values = Object.keys(data).filter(k => k in fieldMap).map(k => {
    const v = (data as Record<string, unknown>)[k]
    return k === 'nome' ? String(v).toUpperCase() : v
  })

  if (!setClauses) return c.json({ error: 'Nenhum campo para atualizar.' }, 400)

  await c.env.DB_SHARED
    .prepare(`UPDATE locais SET ${setClauses}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, now, auditUserId(c), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Local atualizado.' })
})

app.delete('/locais/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED
    .prepare('DELETE FROM locais WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ message: 'Local removido.' })
})

export default app
