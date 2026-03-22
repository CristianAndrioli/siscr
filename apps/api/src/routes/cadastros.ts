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
  cpfCnpj: z.string().min(11).max(14),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  empresaId: z.string().uuid(),
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

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO pessoas (id, tenant_id, empresa_id, filial_id, tipo, tipo_cadastro, nome, cpf_cnpj, email, telefone, ativo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(id, tenant.tenantId, data.empresaId, data.filialId ?? null, data.tipo, data.tipoCadastro,
      data.nome, data.cpfCnpj, data.email ?? null, data.telefone ?? null, 1, new Date().toISOString())
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
  const fields = Object.entries(data)
    .map(([k]) => `${camelToSnake(k)} = ?`)
    .join(', ')
  const values = Object.values(data)

  await c.env.DB_SHARED
    .prepare(`UPDATE pessoas SET ${fields}, updated_at = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Atualizado com sucesso.' })
})

// ─── Produtos ─────────────────────────────────────────────────────

const produtoSchema = z.object({
  codigo: z.string().min(1),
  descricao: z.string().min(2),
  unidade: z.string().default('UN'),
  precoVenda: z.number().positive(),
  precoCusto: z.number().nonnegative().optional(),
  ncm: z.string().optional(),
  ativo: z.boolean().default(true),
  empresaId: z.string().uuid(),
})

app.get('/produtos', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, busca } = c.req.query()

  let query = 'SELECT id, codigo, descricao, unidade, preco_venda, ativo FROM produtos WHERE tenant_id = ?'
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

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO produtos (id, tenant_id, empresa_id, codigo, descricao, unidade, preco_venda, preco_custo, ncm, ativo, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(id, tenant.tenantId, data.empresaId, data.codigo, data.descricao, data.unidade,
      data.precoVenda, data.precoCusto ?? 0, data.ncm ?? null, data.ativo ? 1 : 0, new Date().toISOString())
    .run()

  return c.json({ id, message: 'Produto cadastrado com sucesso.' }, 201)
})

// ─── Serviços ─────────────────────────────────────────────────────

app.get('/servicos', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId } = c.req.query()

  let query = 'SELECT id, codigo, descricao, preco, ativo FROM servicos WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND empresa_id = ?'; params.push(empresaId) }
  query += ' ORDER BY descricao'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ servicos: results })
})

// ─── Utilitário ───────────────────────────────────────────────────
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

export default app
