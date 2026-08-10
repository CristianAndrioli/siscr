import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'
import { parseListPagination } from '../lib/listPagination'
import {
  createPessoaService,
  createProdutoService,
  createServicoService,
} from '../services/cadastros/factory'
import {
  DEMO_EMAIL_SUFFIX,
  DEMO_PESSOAS,
  DEMO_PRODUTOS,
  DEMO_SERVICOS,
  DEMO_SKU_PREFIX,
} from '../lib/cadastros/demoCadastros'
import type {
  PessoaCreateInput,
} from '../services/cadastros/PessoaService'
import type { PessoaUpdateFields } from '../repositories/PessoaRepository'
import type {
  ProdutoCreateInput,
  ProdutoUpdateInput,
} from '../services/cadastros/ProdutoService'
import type {
  ServicoCreateInput,
  ServicoUpdateInput,
} from '../services/cadastros/ServicoService'

/**
 * Rotas de cadastros básicos — Pessoas, Produtos e Serviços.
 *
 * Papel da rota
 * -----------------------------------------------------------------
 * - Validar entrada com Zod.
 * - Extrair `tenantId`/`auditUserId` do contexto.
 * - Chamar o service correspondente e traduzir exceções em status
 *   HTTP (ex.: UNIQUE de SKU → 409).
 *
 * Toda regra de negócio e SQL fica no service/repository. Evite
 * reintroduzir `await c.env.DB_SHARED.prepare(...)` aqui.
 */

const app = new Hono<{ Bindings: Env }>()

// Converte string vazia para undefined para que campos opcionais passem na validação.
const emptyToUndef = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema)

// ─── Pessoas (Clientes / Fornecedores / Funcionários / Transportadoras) ──

const pessoaSchema = z.object({
  tipo: z.enum(['PF', 'PJ']),
  tipoCadastro: z.enum(['cliente', 'fornecedor', 'funcionario', 'transportadora', 'vendedor']),
  nome: z.string().min(2),
  cpfCnpj: emptyToUndef(z.string().min(11).max(18).optional()),
  email: emptyToUndef(z.string().email().optional()),
  telefone: emptyToUndef(z.string().optional()),
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
  empresaId: emptyToUndef(z.string().uuid().optional()),
  filialId: emptyToUndef(z.string().uuid().optional()),
  // Papel "vendedor"
  comissaoPercentual: emptyToUndef(z.coerce.number().min(0).max(100).optional()),
  metaMensal: emptyToUndef(z.coerce.number().min(0).optional()),
  // Papel "funcionário/operador"
  matricula: emptyToUndef(z.string().max(30).optional()),
  tipoOperador: emptyToUndef(z.enum(['motorista', 'operador_maquina', 'tecnico', 'administrativo', 'outro']).optional()),
  cnhNumero: emptyToUndef(z.string().max(20).optional()),
  cnhCategoria: emptyToUndef(z.string().max(5).optional()),
  cnhValidade: emptyToUndef(z.string().optional()),
})

app.get('/pessoas', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, tipo, tipoCadastro, busca } = c.req.query()
  const { limit, offset, page } = parseListPagination(c)

  const svc = createPessoaService(c.env.DB_SHARED, tenant.tenantId)
  const { rows, total } = await svc.list({ empresaId, filialId, tipo, tipoCadastro, busca }, limit, offset)
  return c.json({ pessoas: rows, total, page, limit })
})

app.post('/pessoas', zValidator('json', pessoaSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json') as PessoaCreateInput
  const svc = createPessoaService(c.env.DB_SHARED, tenant.tenantId)
  try {
    const id = await svc.create(data, auditUserId(c))
    return c.json({ id, message: 'Pessoa cadastrada com sucesso.' }, 201)
  } catch (err) {
    const msg = String((err as Error)?.message ?? '')
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('cpf_cnpj')) {
      return c.json({ error: 'CPF/CNPJ já cadastrado para outro registro.' }, 409)
    }
    return c.json({ error: 'Erro ao cadastrar pessoa. Verifique os dados e tente novamente.' }, 500)
  }
})

app.get('/pessoas/:id', async (c) => {
  const tenant = c.get('tenant')
  const svc = createPessoaService(c.env.DB_SHARED, tenant.tenantId)
  const row = await svc.findById(c.req.param('id'))
  if (!row) return c.json({ error: 'Registro não encontrado.' }, 404)
  return c.json(row)
})

app.put('/pessoas/:id', zValidator('json', pessoaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const patch = c.req.valid('json') as PessoaUpdateFields
  const svc = createPessoaService(c.env.DB_SHARED, tenant.tenantId)
  try {
    const ok = await svc.update(c.req.param('id'), patch, auditUserId(c))
    if (!ok) return c.json({ error: 'Nenhum campo válido foi informado para atualização.' }, 400)
    return c.json({ message: 'Atualizado com sucesso.' })
  } catch (err) {
    const msg = String((err as Error)?.message ?? '')
    if (msg.toLowerCase().includes('unique') || msg.toLowerCase().includes('cpf_cnpj')) {
      return c.json({ error: 'CPF/CNPJ já cadastrado para outro registro.' }, 409)
    }
    return c.json({ error: 'Erro ao atualizar pessoa. Verifique os dados e tente novamente.' }, 500)
  }
})

app.delete('/pessoas/:id', async (c) => {
  const tenant = c.get('tenant')
  const svc = createPessoaService(c.env.DB_SHARED, tenant.tenantId)
  await svc.delete(c.req.param('id'))
  return c.json({ message: 'Removido com sucesso.' })
})

// ─── Produtos ───────────────────────────────────────────────────────

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
  const { limit, offset, page } = parseListPagination(c)

  const svc = createProdutoService(c.env.DB_SHARED, tenant.tenantId)
  const { rows, total } = await svc.list({ empresaId, busca }, limit, offset)
  return c.json({ produtos: rows, total, page, limit })
})

app.post('/produtos', zValidator('json', produtoSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json') as ProdutoCreateInput
  const svc = createProdutoService(c.env.DB_SHARED, tenant.tenantId)
  try {
    const { id, codigo } = await svc.create(data, auditUserId(c))
    return c.json({ id, codigo, message: 'Produto cadastrado com sucesso.' }, 201)
  } catch {
    if (data.sku) return c.json({ error: `SKU "${data.sku}" já está em uso por outro produto.` }, 409)
    return c.json({ error: 'Erro ao cadastrar produto.' }, 500)
  }
})

app.get('/produtos/:id', async (c) => {
  const tenant = c.get('tenant')
  const svc = createProdutoService(c.env.DB_SHARED, tenant.tenantId)
  const row = await svc.findById(c.req.param('id'))
  if (!row) return c.json({ error: 'Produto não encontrado.' }, 404)
  return c.json(row)
})

app.put('/produtos/:id', zValidator('json', produtoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json') as ProdutoUpdateInput
  const svc = createProdutoService(c.env.DB_SHARED, tenant.tenantId)
  try {
    const ok = await svc.update(c.req.param('id'), data, auditUserId(c))
    if (!ok) return c.json({ error: 'Nenhum campo válido foi informado para atualização.' }, 400)
    return c.json({ message: 'Atualizado com sucesso.' })
  } catch {
    if (data.sku) return c.json({ error: `SKU "${data.sku}" já está em uso por outro produto.` }, 409)
    return c.json({ error: 'Erro ao atualizar produto.' }, 500)
  }
})

app.delete('/produtos/:id', async (c) => {
  const tenant = c.get('tenant')
  const svc = createProdutoService(c.env.DB_SHARED, tenant.tenantId)
  await svc.delete(c.req.param('id'))
  return c.json({ message: 'Removido com sucesso.' })
})

// ─── Serviços ───────────────────────────────────────────────────────

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
  const { limit, offset, page } = parseListPagination(c)

  const svc = createServicoService(c.env.DB_SHARED, tenant.tenantId)
  const { rows, total } = await svc.list({ empresaId, busca }, limit, offset)
  return c.json({ servicos: rows, total, page, limit })
})

app.post('/servicos', zValidator('json', servicoSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json') as ServicoCreateInput
  const svc = createServicoService(c.env.DB_SHARED, tenant.tenantId)
  try {
    const { id, codigo } = await svc.create(data, auditUserId(c))
    return c.json({ id, codigo, message: 'Serviço cadastrado com sucesso.' }, 201)
  } catch {
    if (data.sku) return c.json({ error: `SKU "${data.sku}" já está em uso por outro serviço.` }, 409)
    return c.json({ error: 'Erro ao cadastrar serviço.' }, 500)
  }
})

app.get('/servicos/:id', async (c) => {
  const tenant = c.get('tenant')
  const svc = createServicoService(c.env.DB_SHARED, tenant.tenantId)
  const row = await svc.findById(c.req.param('id'))
  if (!row) return c.json({ error: 'Serviço não encontrado.' }, 404)
  return c.json(row)
})

app.put('/servicos/:id', zValidator('json', servicoSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json') as ServicoUpdateInput
  const svc = createServicoService(c.env.DB_SHARED, tenant.tenantId)
  try {
    const ok = await svc.update(c.req.param('id'), data, auditUserId(c))
    if (!ok) return c.json({ error: 'Nenhum campo válido foi informado para atualização.' }, 400)
    return c.json({ message: 'Atualizado com sucesso.' })
  } catch {
    if (data.sku) return c.json({ error: `SKU "${data.sku}" já está em uso por outro serviço.` }, 409)
    return c.json({ error: 'Erro ao atualizar serviço.' }, 500)
  }
})

app.delete('/servicos/:id', async (c) => {
  const tenant = c.get('tenant')
  const svc = createServicoService(c.env.DB_SHARED, tenant.tenantId)
  await svc.delete(c.req.param('id'))
  return c.json({ message: 'Removido com sucesso.' })
})

/**
 * Importa clientes, fornecedores, produtos e serviços de demonstração (idempotente).
 */
app.post('/seed', async (c) => {
  const tenant = c.get('tenant')
  const userId = auditUserId(c)

  const jaTem = await c.env.DB_SHARED
    .prepare(
      `SELECT COUNT(*) as c FROM pessoas
       WHERE tenant_id = ? AND email LIKE ?`,
    )
    .bind(tenant.tenantId, `%${DEMO_EMAIL_SUFFIX}`)
    .first<{ c: number }>()

  if ((jaTem?.c ?? 0) > 0) {
    return c.json(
      {
        error:
          'Dados de demonstração já foram importados neste tenant. Remova os registros @demo.siscr.local / SKU DEMO-* para reimportar.',
      },
      409,
    )
  }

  const empresa = await c.env.DB_SHARED
    .prepare(`SELECT id FROM empresas WHERE tenant_id = ? ORDER BY created_at LIMIT 1`)
    .bind(tenant.tenantId)
    .first<{ id: string }>()

  const empresaId = empresa?.id
  const pessoaSvc = createPessoaService(c.env.DB_SHARED, tenant.tenantId)
  const produtoSvc = createProdutoService(c.env.DB_SHARED, tenant.tenantId)
  const servicoSvc = createServicoService(c.env.DB_SHARED, tenant.tenantId)

  let pessoas = 0
  let produtos = 0
  let servicos = 0

  for (const p of DEMO_PESSOAS) {
    await pessoaSvc.create(
      {
        ...p,
        empresaId,
      },
      userId,
    )
    pessoas += 1
  }

  for (const p of DEMO_PRODUTOS) {
    await produtoSvc.create(
      {
        ...p,
        ativo: true,
        empresaId,
      },
      userId,
    )
    produtos += 1
  }

  for (const s of DEMO_SERVICOS) {
    await servicoSvc.create(
      {
        ...s,
        ativo: true,
        empresaId,
      },
      userId,
    )
    servicos += 1
  }

  return c.json(
    {
      ok: true,
      message: 'Cadastros de demonstração importados.',
      pessoas,
      produtos,
      servicos,
      marcadores: { email: DEMO_EMAIL_SUFFIX, sku: DEMO_SKU_PREFIX },
    },
    201,
  )
})

export default app
