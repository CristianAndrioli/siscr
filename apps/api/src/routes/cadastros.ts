import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { nextCodigo } from '../lib/nextCodigo'

const app = new Hono<{ Bindings: Env }>()

// ─── Pessoas (Clientes / Fornecedores / Funcionários) ────────────

// Converte string vazia para undefined para que campos opcionais passem na validação
const emptyToUndef = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema)

const pessoaSchema = z.object({
  tipo: z.enum(['PF', 'PJ']),
  tipoCadastro: z.enum(['cliente', 'fornecedor', 'funcionario', 'transportadora']),
  nome: z.string().min(2),
  cpfCnpj: emptyToUndef(z.string().min(11).max(18).optional()),
  email: emptyToUndef(z.string().email().optional()),
  telefone: emptyToUndef(z.string().optional()),
  // endereço
  cep: emptyToUndef(z.string().optional()),
  logradouro: emptyToUndef(z.string().optional()),
  numero: emptyToUndef(z.string().optional()),
  complemento: emptyToUndef(z.string().optional()),
  bairro: emptyToUndef(z.string().optional()),
  cidade: emptyToUndef(z.string().optional()),
  uf: emptyToUndef(z.string().length(2).optional()),
  inscricaoEstadual: emptyToUndef(z.string().optional()),
  indIeDest: emptyToUndef(z.enum(['1', '2', '9']).optional()),
  codigoMunicipio: emptyToUndef(z.string().max(7).optional()),
  codigoPais: emptyToUndef(z.string().max(4).optional()),
  // vínculo
  empresaId: emptyToUndef(z.string().uuid().optional()),
  filialId: emptyToUndef(z.string().uuid().optional()),
})

app.get('/pessoas', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, tipo, tipoCadastro, busca } = c.req.query()

  let query = `SELECT id, codigo, tipo, tipo_cadastro, nome, cpf_cnpj, email, telefone, ativo, created_at
               FROM pessoas WHERE tenant_id = ?`
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND empresa_id = ?'; params.push(empresaId) }
  if (filialId) { query += ' AND filial_id = ?'; params.push(filialId) }
  if (tipo) { query += ' AND tipo = ?'; params.push(tipo) }
  if (tipoCadastro) { query += ' AND tipo_cadastro = ?'; params.push(tipoCadastro) }
  if (busca) { query += ' AND (nome LIKE ? OR cpf_cnpj LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`) }

  query += ' ORDER BY codigo LIMIT 100'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ pessoas: results })
})

app.post('/pessoas', zValidator('json', pessoaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO pessoas (id, tenant_id, empresa_id, filial_id, tipo, tipo_cadastro, nome, cpf_cnpj, email, telefone,
        cep, logradouro, numero, complemento, bairro, cidade, uf,
        inscricao_estadual, ind_ie_dest, codigo_municipio, codigo_pais,
        ativo, created_at, updated_at, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    `)
    .bind(
      id, tenant.tenantId,
      data.empresaId ?? null, data.filialId ?? null,
      data.tipo, data.tipoCadastro,
      data.nome, data.cpfCnpj ?? null,
      data.email ?? null, data.telefone ?? null,
      data.cep ?? null, data.logradouro ?? null, data.numero ?? null,
      data.complemento ?? null, data.bairro ?? null, data.cidade ?? null, data.uf ?? null,
      data.inscricaoEstadual ?? null,
      data.indIeDest ?? '9',
      data.codigoMunicipio ?? null,
      data.codigoPais ?? '1058',
      now, now, uid, uid,
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
    cep: 'cep',
    logradouro: 'logradouro',
    numero: 'numero',
    complemento: 'complemento',
    bairro: 'bairro',
    cidade: 'cidade',
    uf: 'uf',
    inscricaoEstadual: 'inscricao_estadual',
    indIeDest: 'ind_ie_dest',
    codigoMunicipio: 'codigo_municipio',
    codigoPais: 'codigo_pais',
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
    .prepare(`UPDATE pessoas SET ${setClauses}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
    .bind(...values, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
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
  sku: z.string().optional(),
  descricao: z.string().min(2),
  unidade: z.string().default('UN'),
  precoVenda: z.number().nonnegative(),
  precoCusto: z.number().nonnegative().optional(),
  ncm: z.string().optional(),
  origem: z.coerce.number().int().min(0).max(8).optional(),
  cest: z.string().optional(),
  icmsCst: z.string().optional(),
  icmsCsosn: z.string().optional(),
  pisCst: z.string().optional(),
  cofinsCst: z.string().optional(),
  ativo: z.boolean().default(true),
  empresaId: z.string().uuid().optional(),
})

app.get('/produtos', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, busca } = c.req.query()

  let query = `SELECT id, codigo, sku, descricao, unidade, preco_venda, preco_custo, ncm,
    origem, cest, icms_cst, icms_csosn, pis_cst, cofins_cst, ativo FROM produtos WHERE tenant_id = ?`
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND empresa_id = ?'; params.push(empresaId) }
  if (busca) { query += ' AND (descricao LIKE ? OR codigo LIKE ? OR sku LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`) }

  query += ' ORDER BY CAST(codigo AS INTEGER) LIMIT 100'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ produtos: results })
})

app.post('/produtos', zValidator('json', produtoSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const codigo = await nextCodigo(c.env.DB_SHARED, 'produtos', tenant.tenantId)

  try {
    await c.env.DB_SHARED
      .prepare(`
        INSERT INTO produtos (id, tenant_id, empresa_id, codigo, sku, descricao, unidade, preco_venda, preco_custo, ncm,
          origem, cest, icms_cst, icms_csosn, pis_cst, cofins_cst, ativo, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id, tenant.tenantId,
        data.empresaId ?? null,
        codigo, data.sku ?? null,
        data.descricao, data.unidade,
        data.precoVenda, data.precoCusto ?? 0,
        data.ncm ?? null,
        data.origem ?? 0,
        data.cest ?? null,
        data.icmsCst ?? null,
        data.icmsCsosn ?? null,
        data.pisCst ?? '07',
        data.cofinsCst ?? '07',
        data.ativo ? 1 : 0,
        now, now, uid, uid,
      )
      .run()
  } catch {
    if (data.sku) return c.json({ error: `SKU "${data.sku}" já está em uso por outro produto.` }, 409)
    throw new Error('Erro ao cadastrar produto.')
  }

  return c.json({ id, codigo, message: 'Produto cadastrado com sucesso.' }, 201)
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
    // codigo é gerenciado pelo sistema — não pode ser alterado pelo usuário
    sku: 'sku',
    descricao: 'descricao',
    unidade: 'unidade',
    precoVenda: 'preco_venda',
    precoCusto: 'preco_custo',
    ncm: 'ncm',
    origem: 'origem',
    cest: 'cest',
    icmsCst: 'icms_cst',
    icmsCsosn: 'icms_csosn',
    pisCst: 'pis_cst',
    cofinsCst: 'cofins_cst',
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

  try {
    await c.env.DB_SHARED
      .prepare(`UPDATE produtos SET ${setClauses}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
      .bind(...values, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
      .run()
  } catch {
    if (data.sku) return c.json({ error: `SKU "${data.sku}" já está em uso por outro produto.` }, 409)
    throw new Error('Erro ao atualizar produto.')
  }

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
  sku: z.string().optional(),
  descricao: z.string().min(2),
  unidade: z.string().default('UN'),
  preco: z.number().nonnegative(),
  ativo: z.boolean().default(true),
  empresaId: z.string().uuid().optional(),
})

app.get('/servicos', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, busca } = c.req.query()

  let query = 'SELECT id, codigo, sku, descricao, unidade, preco, ativo FROM servicos WHERE tenant_id = ?'
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND empresa_id = ?'; params.push(empresaId) }
  if (busca) { query += ' AND (descricao LIKE ? OR codigo LIKE ? OR sku LIKE ?)'; params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`) }

  query += ' ORDER BY CAST(codigo AS INTEGER)'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ servicos: results })
})

app.post('/servicos', zValidator('json', servicoSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const uid = auditUserId(c)
  const codigo = await nextCodigo(c.env.DB_SHARED, 'servicos', tenant.tenantId)

  try {
    await c.env.DB_SHARED
      .prepare(`
        INSERT INTO servicos (id, tenant_id, empresa_id, codigo, sku, descricao, unidade, preco, ativo, created_at, updated_at, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id, tenant.tenantId,
        data.empresaId ?? null,
        codigo, data.sku ?? null,
        data.descricao, data.unidade,
        data.preco, data.ativo ? 1 : 0,
        now, now, uid, uid,
      )
      .run()
  } catch {
    if (data.sku) return c.json({ error: `SKU "${data.sku}" já está em uso por outro serviço.` }, 409)
    throw new Error('Erro ao cadastrar serviço.')
  }

  return c.json({ id, codigo, message: 'Serviço cadastrado com sucesso.' }, 201)
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
    // codigo é gerenciado pelo sistema — não pode ser alterado pelo usuário
    sku: 'sku',
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

  try {
    await c.env.DB_SHARED
      .prepare(`UPDATE servicos SET ${setClauses}, updated_at = ?, updated_by = ? WHERE id = ? AND tenant_id = ?`)
      .bind(...values, new Date().toISOString(), auditUserId(c), c.req.param('id'), tenant.tenantId)
      .run()
  } catch {
    if (data.sku) return c.json({ error: `SKU "${data.sku}" já está em uso por outro serviço.` }, 409)
    throw new Error('Erro ao atualizar serviço.')
  }

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
