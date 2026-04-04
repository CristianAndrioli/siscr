import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// ─── Pessoas (Clientes / Fornecedores / Funcionários) ────────────

const pessoaSchema = z.object({
  tipo: z.enum(['PF', 'PJ']),
  tipoCadastro: z.enum(['cliente', 'fornecedor', 'funcionario', 'transportadora']),
  nome: z.string().min(2),
  cpfCnpj: z.string().min(11).max(18).optional(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  empresaId: z.string().uuid().optional(),
  filialId: z.string().uuid().optional(),
})

app.get('/pessoas', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, tipo, tipoCadastro, busca } = c.req.query()

  let query = `SELECT id, tipo, tipo_cadastro, nome, cpf_cnpj, email, telefone, ativo, created_at
               FROM pessoas WHERE tenant_id = ?`
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND empresa_id = ?'; params.push(empresaId) }
  if (filialId) { query += ' AND filial_id = ?'; params.push(filialId) }
  if (tipo) { query += ' AND tipo = ?'; params.push(tipo) }
  if (tipoCadastro) { query += ' AND tipo_cadastro = ?'; params.push(tipoCadastro) }
  if (busca) { query += ' AND (nome LIKE ? OR cpf_cnpj LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  query += ' ORDER BY nome LIMIT 100'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ pessoas: results })
})

app.post('/pessoas', zValidator('json', pessoaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO pessoas (id, tenant_id, empresa_id, filial_id, tipo, tipo_cadastro, nome, cpf_cnpj, email, telefone, ativo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `)
    .bind(
      id, tenant.tenantId,
      data.empresaId ?? null, data.filialId ?? null,
      data.tipo, data.tipoCadastro,
      data.nome, data.cpfCnpj ?? null,
      data.email ?? null, data.telefone ?? null,
      now, now,
    )
    .run()

  return c.json({ id, message: 'Pessoa cadastrada com sucesso.' }, 201)
})

app.get('/pessoas/:id', async (c) => {
  const tenant = c.get('tenant')
  const result = await c.env.DB_SHARED
    .prepare('SELECT * FROM pessoas WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .first()

  if (!result) return c.json({ error: 'Registro não encontrado.' }, 404)
  return c.json(result)
})

app.put('/pessoas/:id', zValidator('json', pessoaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const fieldMap: Record<string, string> = {
    tipo: 'tipo',
    tipoCadastro: 'tipo_cadastro',
    nome: 'nome',
    cpfCnpj: 'cpf_cnpj',
    email: 'email',
    telefone: 'telefone',
    empresaId: 'empresa_id',
    filialId: 'filial_id',
  }

  const setClauses = Object.keys(data)
    .filter(k => k in fieldMap)
    .map(k => `${fieldMap[k]} = ?`)
    .join(', ')

  const values = Object.keys(data)
    .filter(k => k in fieldMap)
    .map(k => (data as Record<string, unknown>)[k])

  if (!setClauses) return c.json({ error: 'Nenhum campo para atualizar.' }, 400)

  await c.env.DB_SHARED
    .prepare(`UPDATE pessoas SET ${setClauses}, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Atualizado com sucesso.' })
})

app.delete('/pessoas/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED
    .prepare('DELETE FROM pessoas WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ message: 'Removido com sucesso.' })
})

// ─── Produtos ─────────────────────────────────────────────────────

const produtoSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(2),
  unidade: z.string().default('UN'),
  precoVenda: z.number().nonnegative(),
  precoCusto: z.number().nonnegative().optional(),
  ncm: z.string().optional(),
  ativo: z.boolean().default(true),
  empresaId: z.string().uuid().optional(),
})

app.get('/produtos', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, busca } = c.req.query()

  let query = 'SELECT id, codigo, descricao, unidade, preco_venda, preco_custo, ncm, ativo FROM produtos WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND empresa_id = ?'; params.push(empresaId) }
  if (busca) { query += ' AND (descricao LIKE ? OR codigo LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  query += ' ORDER BY descricao LIMIT 100'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ produtos: results })
})

app.post('/produtos', zValidator('json', produtoSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO produtos (id, tenant_id, empresa_id, codigo, descricao, unidade, preco_venda, preco_custo, ncm, ativo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id, tenant.tenantId,
      data.empresaId ?? null,
      data.codigo, data.descricao, data.unidade,
      data.precoVenda, data.precoCusto ?? 0,
      data.ncm ?? null, data.ativo ? 1 : 0,
      now, now,
    )
    .run()

  return c.json({ id, message: 'Produto cadastrado com sucesso.' }, 201)
})

app.get('/produtos/:id', async (c) => {
  const tenant = c.get('tenant')
  const result = await c.env.DB_SHARED
    .prepare('SELECT * FROM produtos WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .first()

  if (!result) return c.json({ error: 'Produto não encontrado.' }, 404)
  return c.json(result)
})

app.put('/produtos/:id', zValidator('json', produtoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const fieldMap: Record<string, string> = {
    codigo: 'codigo',
    descricao: 'descricao',
    unidade: 'unidade',
    precoVenda: 'preco_venda',
    precoCusto: 'preco_custo',
    ncm: 'ncm',
    ativo: 'ativo',
    empresaId: 'empresa_id',
  }

  const setClauses = Object.keys(data)
    .filter(k => k in fieldMap)
    .map(k => `${fieldMap[k]} = ?`)
    .join(', ')

  const values = Object.keys(data)
    .filter(k => k in fieldMap)
    .map(k => {
      const v = (data as Record<string, unknown>)[k]
      if (k === 'ativo') return v ? 1 : 0
      return v
    })

  if (!setClauses) return c.json({ error: 'Nenhum campo para atualizar.' }, 400)

  await c.env.DB_SHARED
    .prepare(`UPDATE produtos SET ${setClauses}, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Atualizado com sucesso.' })
})

app.delete('/produtos/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED
    .prepare('DELETE FROM produtos WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ message: 'Removido com sucesso.' })
})

// ─── Serviços ─────────────────────────────────────────────────────

const servicoSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(2),
  unidade: z.string().default('UN'),
  preco: z.number().nonnegative(),
  ativo: z.boolean().default(true),
  empresaId: z.string().uuid().optional(),
})

app.get('/servicos', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, busca } = c.req.query()

  let query = 'SELECT id, codigo, descricao, unidade, preco, ativo FROM servicos WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND empresa_id = ?'; params.push(empresaId) }
  if (busca) { query += ' AND (descricao LIKE ? OR codigo LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  query += ' ORDER BY descricao'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ servicos: results })
})

app.post('/servicos', zValidator('json', servicoSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO servicos (id, tenant_id, empresa_id, codigo, descricao, unidade, preco, ativo, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id, tenant.tenantId,
      data.empresaId ?? null,
      data.codigo, data.descricao, data.unidade,
      data.preco, data.ativo ? 1 : 0,
      now, now,
    )
    .run()

  return c.json({ id, message: 'Serviço cadastrado com sucesso.' }, 201)
})

app.get('/servicos/:id', async (c) => {
  const tenant = c.get('tenant')
  const result = await c.env.DB_SHARED
    .prepare('SELECT * FROM servicos WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .first()

  if (!result) return c.json({ error: 'Serviço não encontrado.' }, 404)
  return c.json(result)
})

app.put('/servicos/:id', zValidator('json', servicoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const fieldMap: Record<string, string> = {
    codigo: 'codigo',
    descricao: 'descricao',
    unidade: 'unidade',
    preco: 'preco',
    ativo: 'ativo',
    empresaId: 'empresa_id',
  }

  const setClauses = Object.keys(data)
    .filter(k => k in fieldMap)
    .map(k => `${fieldMap[k]} = ?`)
    .join(', ')

  const values = Object.keys(data)
    .filter(k => k in fieldMap)
    .map(k => {
      const v = (data as Record<string, unknown>)[k]
      if (k === 'ativo') return v ? 1 : 0
      return v
    })

  if (!setClauses) return c.json({ error: 'Nenhum campo para atualizar.' }, 400)

  await c.env.DB_SHARED
    .prepare(`UPDATE servicos SET ${setClauses}, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Atualizado com sucesso.' })
})

app.delete('/servicos/:id', async (c) => {
  const tenant = c.get('tenant')
  await c.env.DB_SHARED
    .prepare('DELETE FROM servicos WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId)
    .run()
  return c.json({ message: 'Removido com sucesso.' })
})

export default app
