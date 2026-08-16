import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { PasswordHasher } from '../lib/password'
import type { EmpresaUpdateFields } from '../repositories/EmpresaRepository'
import type { FilialUpdateFields } from '../repositories/FilialRepository'
import { decryptA1Bundle, encryptA1Bundle } from '../lib/certBlob'
import { extractA1CertPublicMeta } from '../lib/pfxMetadata'
import { EmpresaRepository } from '../repositories/EmpresaRepository'
import { FilialRepository } from '../repositories/FilialRepository'
import { auditUserId } from '../lib/audit'
import {
  checkCanCreateEmpresa,
  checkCanCreateFilial,
  checkCanCreateUsuario,
  getTenantUsage,
  resolvePlanForTenant,
} from '../lib/planLimits'
import { createEmpresaFilialService, createTenantInfoService } from '../services/tenant/factory'
import {
  applyStripeSubscriptionId,
} from '../lib/stripe/tenantBilling'
import {
  fetchSubscription,
  findActiveSubscriptionId,
  resolvePriceIdForPlan,
  stripeRequest,
} from '../lib/stripe/stripeApi'
import { getFiscalDocUsoMes } from '../lib/fiscalDocQuota'

function jsonHttpError(c: { json: (b: unknown, s?: number) => Response }, e: unknown) {
  if (e instanceof Error && typeof (e as Error & { status?: number }).status === 'number') {
    const status = (e as Error & { status: number }).status
    return c.json({ error: e.message }, status)
  }
  throw e
}

const app = new Hono<{ Bindings: Env }>()

// GET /api/tenant/info — dados do tenant atual
app.get('/', async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const info = createTenantInfoService(c.env.DB_SHARED, tenant.tenantId)
  const data = await info.getTenant()
  return c.json({ tenant: data, currentUser: user })
})

// GET /api/tenant/info/onboarding — primeira empresa obrigatória; certificado A1 opcional (R2 + secret)
app.get('/onboarding', async (c) => {
  const tenant = c.get('tenant')
  const repo = new EmpresaRepository(c.env.DB_SHARED, tenant.tenantId)
  const empresaCount = await repo.count()
  return c.json({
    needsEmpresaOnboarding: empresaCount === 0,
    empresaCount,
    certificateStorageReady: Boolean(c.env.R2_STORAGE && c.env.CERT_BLOB_SECRET?.trim()),
  })
})

// GET /api/tenant/info/empresas — listar empresas do tenant
app.get('/empresas', async (c) => {
  const tenant = c.get('tenant')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  const empresas = await svc.listEmpresas()
  return c.json({ empresas })
})

// POST /api/tenant/info/empresas — criar empresa
const empresaSchema = z.object({
  razaoSocial: z.string().min(2),
  nomeFantasia: z.string().optional(),
  cnpj: z.string().length(14),
  inscricaoEstadual: z.string().optional().nullable(),
  inscricaoMunicipal: z.string().optional().nullable(),
  email: z.string().email().optional(),
  telefone: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().length(2).optional(),
  cep: z.string().optional(),
  codigoMunicipio: z.string().max(7).optional(),
  crt: z.enum(['1', '2', '3']).optional(),
  cnae: z.string().max(10).optional(),
  nfeSerie: z.string().max(3).optional(),
  nfeAmbiente: z.coerce.number().int().min(1).max(2).optional(),
  nfeProximoNumero: z.coerce.number().int().min(1).optional(),
  nfseSerie: z.string().max(5).optional(),
  nfseAmbiente: z.coerce.number().int().min(1).max(2).optional(),
  nfseProximoNumero: z.coerce.number().int().min(1).optional(),
  nfseCodigoServicoPadrao: z.string().max(20).optional().nullable(),
})

app.post('/empresas', zValidator('json', empresaSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const empRepo = new EmpresaRepository(c.env.DB_SHARED, tenant.tenantId)
  const n = await empRepo.count()
  if (n === 0 && user.role !== 'admin') {
    return c.json({ error: 'Somente o administrador pode cadastrar a primeira empresa do ambiente.' }, 403)
  }
  const limite = await checkCanCreateEmpresa(c.env.DB_SHARED, tenant.tenantId)
  if (limite) return c.json(limite, 403)

  const data = c.req.valid('json')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  const id = await svc.createEmpresa(data, auditUserId(c))
  return c.json({ id, message: 'Empresa criada com sucesso.' }, 201)
})

// GET /api/tenant/info/empresas/:id/filiais
app.get('/empresas/:id/filiais', async (c) => {
  const tenant = c.get('tenant')
  const empresaId = c.req.param('id')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  try {
    const filiais = await svc.listFiliaisByEmpresa(empresaId)
    return c.json({ filiais })
  } catch (e) {
    return jsonHttpError(c, e)
  }
})

// POST /api/tenant/info/empresas/:id/filiais — criar filial
const filialSchema = z.object({
  nome: z.string().min(2),
  cnpj: z.string().optional(),
  uf: z.string().length(2).optional(),
  cidade: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cep: z.string().optional(),
  codigoMunicipio: z.string().max(7).optional(),
  inscricaoEstadual: z.string().optional(),
  inscricaoMunicipal: z.string().optional(),
})

app.post('/empresas/:id/filiais', zValidator('json', filialSchema), async (c) => {
  const tenant = c.get('tenant')
  const empresaId = c.req.param('id')
  const data = c.req.valid('json')
  const limite = await checkCanCreateFilial(c.env.DB_SHARED, tenant.tenantId)
  if (limite) return c.json(limite, 403)

  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  try {
    const id = await svc.createFilial(empresaId, data, auditUserId(c))
    return c.json({ id, message: 'Filial criada com sucesso.' }, 201)
  } catch (e) {
    return jsonHttpError(c, e)
  }
})

// POST /api/tenant/info/empresas/:id/certificado-a1 — .pfx/.p12 cifrado e gravado no R2 (opcional no onboarding)
app.post('/empresas/:id/certificado-a1', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem enviar o certificado digital A1.' }, 403)
  }

  const tenant = c.get('tenant')
  const empresaId = c.req.param('id')
  const empRepo = new EmpresaRepository(c.env.DB_SHARED, tenant.tenantId)
  const found = await empRepo.findIdByTenant(empresaId)
  if (!found) {
    return c.json({ error: 'Empresa não encontrada.' }, 404)
  }

  if (!c.env.R2_STORAGE || !c.env.CERT_BLOB_SECRET?.trim()) {
    return c.json(
      {
        error:
          'O envio do certificado digital ainda não está disponível. Você poderá configurá-lo depois no local adequado.',
        code: 'CERT_STORAGE_UNAVAILABLE',
      },
      503,
    )
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Use multipart/form-data com os campos file e password.' }, 400)
  }

  const fileEntry = formData.get('file')
  const password = String(formData.get('password') ?? '')

  const isFileBlob =
    typeof fileEntry === 'object' &&
    fileEntry !== null &&
    'arrayBuffer' in fileEntry &&
    typeof (fileEntry as Blob).arrayBuffer === 'function'

  if (!isFileBlob) {
    return c.json({ error: 'Arquivo obrigatório (campo file: .pfx ou .p12).' }, 400)
  }
  const file = fileEntry as File
  if (!password) {
    return c.json({ error: 'Informe a senha do certificado.' }, 400)
  }

  const name = (file.name || '').toLowerCase()
  if (!name.endsWith('.pfx') && !name.endsWith('.p12')) {
    return c.json({ error: 'Envie um arquivo .pfx ou .p12 (certificado A1).' }, 400)
  }

  const buf = await file.arrayBuffer()
  if (buf.byteLength > 512 * 1024) {
    return c.json({ error: 'Arquivo muito grande (máximo 512 KB).' }, 400)
  }

  let certMeta
  try {
    certMeta = extractA1CertPublicMeta(buf, password)
  } catch (e) {
    return jsonHttpError(c, e)
  }
  const metaJson = JSON.stringify(certMeta)

  const encrypted = await encryptA1Bundle(c.env.CERT_BLOB_SECRET, tenant.tenantId, empresaId, buf, password)

  const objectKey = `tenants/${tenant.tenantId}/a1/${empresaId}.enc`
  const oldKey = await empRepo.getA1ObjectKey(empresaId)
  if (oldKey && oldKey !== objectKey) {
    await c.env.R2_STORAGE.delete(oldKey).catch(() => {})
  }

  await c.env.R2_STORAGE.put(objectKey, encrypted, {
    httpMetadata: { contentType: 'application/octet-stream' },
  })

  const now = new Date().toISOString()
  await empRepo.setA1CertStored(empresaId, objectKey, now, metaJson, auditUserId(c))

  return c.json({
    message: 'Certificado armazenado de forma cifrada.',
    uploadedAt: now,
    certificate: certMeta,
  })
})

// POST /api/tenant/info/empresas/:id/certificado-a1/atualizar-metadados — reextrai metadados do blob já armazenado (admin)
app.post('/empresas/:id/certificado-a1/atualizar-metadados', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem atualizar os dados do certificado.' }, 403)
  }

  const tenant = c.get('tenant')
  const empresaId = c.req.param('id')
  const empRepo = new EmpresaRepository(c.env.DB_SHARED, tenant.tenantId)
  const found = await empRepo.findIdByTenant(empresaId)
  if (!found) {
    return c.json({ error: 'Empresa não encontrada.' }, 404)
  }

  if (!c.env.R2_STORAGE || !c.env.CERT_BLOB_SECRET?.trim()) {
    return c.json(
      {
        error:
          'O armazenamento do certificado não está disponível. Tente novamente mais tarde ou reenvie o arquivo .pfx.',
        code: 'CERT_STORAGE_UNAVAILABLE',
      },
      503,
    )
  }

  const objectKey = await empRepo.getA1ObjectKey(empresaId)
  if (!objectKey) {
    return c.json({ error: 'Nenhum certificado armazenado para esta empresa.' }, 400)
  }

  const obj = await c.env.R2_STORAGE.get(objectKey)
  if (!obj) {
    return c.json({ error: 'Arquivo do certificado não encontrado no armazenamento.' }, 404)
  }

  const enc = await obj.arrayBuffer()
  let pfxBytes: ArrayBuffer
  let pwd: string
  try {
    const bundle = await decryptA1Bundle(c.env.CERT_BLOB_SECRET, tenant.tenantId, empresaId, enc)
    pfxBytes = bundle.pfxBytes
    pwd = bundle.password
  } catch {
    return c.json({ error: 'Não foi possível ler o certificado armazenado (formato inválido ou chave incorreta).' }, 500)
  }

  let certMeta
  try {
    certMeta = extractA1CertPublicMeta(pfxBytes, pwd)
  } catch (e) {
    return jsonHttpError(c, e)
  }

  await empRepo.updateA1CertMetaJson(empresaId, JSON.stringify(certMeta), auditUserId(c))
  return c.json({ message: 'Dados do certificado atualizados.', certificate: certMeta })
})

// PUT /api/tenant/info/empresas/:id — atualizar empresa
app.put('/empresas/:id', zValidator('json', empresaSchema.partial()), async (c) => {
  const tenant = c.get('tenant')
  // O schema parcial do Zod já garante que os campos presentes casam com
  // `EmpresaUpdateFields`; o repositório ainda aplica whitelist defensiva.
  const data = c.req.valid('json') as EmpresaUpdateFields
  const id = c.req.param('id')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  const updated = await svc.updateEmpresa(id, data, auditUserId(c))
  if (!updated) {
    return c.json({ error: 'Nenhum campo válido foi informado para atualização.' }, 400)
  }
  return c.json({ message: 'Empresa atualizada.' })
})

// DELETE /api/tenant/info/empresas/:id
app.delete('/empresas/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const empRepo = new EmpresaRepository(c.env.DB_SHARED, tenant.tenantId)
  const certKey = await empRepo.getA1ObjectKey(id)
  if (certKey && c.env.R2_STORAGE) {
    await c.env.R2_STORAGE.delete(certKey).catch(() => {})
  }
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  await svc.deleteEmpresa(id)
  return c.json({ message: 'Empresa removida.' })
})

// GET /api/tenant/info/filiais — todas as filiais do tenant
app.get('/filiais', async (c) => {
  const tenant = c.get('tenant')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  const filiais = await svc.listAllFiliais()
  return c.json({ filiais })
})

// POST /api/tenant/info/filiais/:id/certificado-a1 — quando a filial emite com CNPJ próprio
app.post('/filiais/:id/certificado-a1', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem enviar o certificado digital A1.' }, 403)
  }

  const tenant = c.get('tenant')
  const filialId = c.req.param('id')
  const filRepo = new FilialRepository(c.env.DB_SHARED, tenant.tenantId)
  const exists = await c.env.DB_SHARED
    .prepare('SELECT id FROM filiais WHERE id = ? AND tenant_id = ?')
    .bind(filialId, tenant.tenantId)
    .first<{ id: string }>()
  if (!exists) {
    return c.json({ error: 'Filial não encontrada.' }, 404)
  }

  if (!c.env.R2_STORAGE || !c.env.CERT_BLOB_SECRET?.trim()) {
    return c.json(
      {
        error:
          'O envio do certificado digital ainda não está disponível. Você poderá configurá-lo depois no local adequado.',
        code: 'CERT_STORAGE_UNAVAILABLE',
      },
      503,
    )
  }

  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Use multipart/form-data com os campos file e password.' }, 400)
  }

  const fileEntry = formData.get('file')
  const password = String(formData.get('password') ?? '')

  const isFileBlob =
    typeof fileEntry === 'object' &&
    fileEntry !== null &&
    'arrayBuffer' in fileEntry &&
    typeof (fileEntry as Blob).arrayBuffer === 'function'

  if (!isFileBlob) {
    return c.json({ error: 'Arquivo obrigatório (campo file: .pfx ou .p12).' }, 400)
  }
  const file = fileEntry as File
  if (!password) {
    return c.json({ error: 'Informe a senha do certificado.' }, 400)
  }

  const name = (file.name || '').toLowerCase()
  if (!name.endsWith('.pfx') && !name.endsWith('.p12')) {
    return c.json({ error: 'Envie um arquivo .pfx ou .p12 (certificado A1).' }, 400)
  }

  const buf = await file.arrayBuffer()
  if (buf.byteLength > 512 * 1024) {
    return c.json({ error: 'Arquivo muito grande (máximo 512 KB).' }, 400)
  }

  let certMeta
  try {
    certMeta = extractA1CertPublicMeta(buf, password)
  } catch (e) {
    return jsonHttpError(c, e)
  }
  const metaJson = JSON.stringify(certMeta)

  const scopeKey = `filial:${filialId}`
  const encrypted = await encryptA1Bundle(c.env.CERT_BLOB_SECRET, tenant.tenantId, scopeKey, buf, password)

  const objectKey = `tenants/${tenant.tenantId}/a1/filial/${filialId}.enc`
  const oldKey = await filRepo.getA1ObjectKey(filialId)
  if (oldKey && oldKey !== objectKey) {
    await c.env.R2_STORAGE.delete(oldKey).catch(() => {})
  }

  await c.env.R2_STORAGE.put(objectKey, encrypted, {
    httpMetadata: { contentType: 'application/octet-stream' },
  })

  const now = new Date().toISOString()
  await filRepo.setA1CertStored(filialId, objectKey, now, metaJson, auditUserId(c))

  return c.json({
    message: 'Certificado armazenado de forma cifrada.',
    uploadedAt: now,
    certificate: certMeta,
  })
})

// POST /api/tenant/info/filiais/:id/certificado-a1/atualizar-metadados
app.post('/filiais/:id/certificado-a1/atualizar-metadados', async (c) => {
  const user = c.get('user')
  if (user.role !== 'admin') {
    return c.json({ error: 'Apenas administradores podem atualizar os dados do certificado.' }, 403)
  }

  const tenant = c.get('tenant')
  const filialId = c.req.param('id')
  const filRepo = new FilialRepository(c.env.DB_SHARED, tenant.tenantId)
  const exists = await c.env.DB_SHARED
    .prepare('SELECT id FROM filiais WHERE id = ? AND tenant_id = ?')
    .bind(filialId, tenant.tenantId)
    .first<{ id: string }>()
  if (!exists) {
    return c.json({ error: 'Filial não encontrada.' }, 404)
  }

  if (!c.env.R2_STORAGE || !c.env.CERT_BLOB_SECRET?.trim()) {
    return c.json(
      {
        error:
          'O armazenamento do certificado não está disponível. Tente novamente mais tarde ou reenvie o arquivo .pfx.',
        code: 'CERT_STORAGE_UNAVAILABLE',
      },
      503,
    )
  }

  const objectKey = await filRepo.getA1ObjectKey(filialId)
  if (!objectKey) {
    return c.json({ error: 'Nenhum certificado armazenado para esta filial.' }, 400)
  }

  const obj = await c.env.R2_STORAGE.get(objectKey)
  if (!obj) {
    return c.json({ error: 'Arquivo do certificado não encontrado no armazenamento.' }, 404)
  }

  const scopeKey = `filial:${filialId}`
  const enc = await obj.arrayBuffer()
  let pfxBytes: ArrayBuffer
  let pwd: string
  try {
    const bundle = await decryptA1Bundle(c.env.CERT_BLOB_SECRET, tenant.tenantId, scopeKey, enc)
    pfxBytes = bundle.pfxBytes
    pwd = bundle.password
  } catch {
    return c.json({ error: 'Não foi possível ler o certificado armazenado (formato inválido ou chave incorreta).' }, 500)
  }

  let certMeta
  try {
    certMeta = extractA1CertPublicMeta(pfxBytes, pwd)
  } catch (e) {
    return jsonHttpError(c, e)
  }

  await filRepo.updateA1CertMetaJson(filialId, JSON.stringify(certMeta), auditUserId(c))
  return c.json({ message: 'Dados do certificado atualizados.', certificate: certMeta })
})

// PUT /api/tenant/info/filiais/:id
app.put('/filiais/:id', zValidator('json', filialSchema.partial().extend({ ativa: z.boolean().optional() })), async (c) => {
  const tenant = c.get('tenant')
  // `ativa` chega como boolean; o service converte para INTEGER (0/1) e
  // aplica whitelist via `FILIAL_COLUMN_MAP`.
  const data = c.req.valid('json') as FilialUpdateFields & { ativa?: boolean }
  const id = c.req.param('id')
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  const updated = await svc.updateFilial(id, data, auditUserId(c))
  if (!updated) {
    return c.json({ error: 'Nenhum campo válido foi informado para atualização.' }, 400)
  }
  return c.json({ message: 'Filial atualizada.' })
})

// DELETE /api/tenant/info/filiais/:id
app.delete('/filiais/:id', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')
  const filRepo = new FilialRepository(c.env.DB_SHARED, tenant.tenantId)
  const certKey = await filRepo.getA1ObjectKey(id)
  if (certKey && c.env.R2_STORAGE) {
    await c.env.R2_STORAGE.delete(certKey).catch(() => {})
  }
  const svc = createEmpresaFilialService(c.env.DB_SHARED, tenant.tenantId)
  await svc.deleteFilial(id)
  return c.json({ message: 'Filial removida.' })
})

// ─── Usuários ─────────────────────────────────────────────────────

// GET /api/tenant/info/usuarios
app.get('/usuarios', async (c) => {
  const tenant = c.get('tenant')
  const { results } = await c.env.DB_SHARED.prepare(
    `SELECT u.id, u.email, u.nome, u.role, u.ativo, u.created_at, u.custom_role_id,
            r.nome AS custom_role_nome
     FROM users u
     LEFT JOIN tenant_custom_roles r ON r.id = u.custom_role_id AND r.tenant_id = u.tenant_id
     WHERE u.tenant_id = ? ORDER BY u.nome`
  ).bind(tenant.tenantId).all()
  return c.json({ usuarios: results })
})

const userSchema = z.object({
  email: z.string().email(),
  nome: z.string().min(2),
  role: z.enum(['admin', 'manager', 'user', 'viewer']).default('user'),
  senha: z.string().min(6).optional(),
  customRoleId: z.string().uuid().nullable().optional(),
})

// POST /api/tenant/info/usuarios
app.post('/usuarios', zValidator('json', userSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')

  const exists = await c.env.DB_SHARED
    .prepare('SELECT id FROM users WHERE email = ? AND tenant_id = ?')
    .bind(data.email, tenant.tenantId).first()
  if (exists) return c.json({ error: 'Já existe um usuário com este e-mail.' }, 400)

  const limite = await checkCanCreateUsuario(c.env.DB_SHARED, tenant.tenantId)
  if (limite) return c.json(limite, 403)

  let customRoleId: string | null = data.customRoleId ?? null
  if (customRoleId) {
    const ok = await c.env.DB_SHARED
      .prepare('SELECT id FROM tenant_custom_roles WHERE id = ? AND tenant_id = ?')
      .bind(customRoleId, tenant.tenantId).first()
    if (!ok) return c.json({ error: 'Perfil personalizado inválido.' }, 400)
  }
  if (data.role === 'admin') customRoleId = null

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  // Usa o formato canônico `pbkdf2$<iter>$<saltHex>$<hashHex>` com 600k iterações.
  // Senhas legadas são aceitas no login via `PasswordHasher.verify()` e promovidas transparentemente.
  const passwordHash = await PasswordHasher.hash(data.senha ?? 'Mudar@123')

  const actor = auditUserId(c)
  await c.env.DB_SHARED.prepare(
    'INSERT INTO users (id, tenant_id, email, nome, password_hash, role, ativo, created_at, custom_role_id, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)'
  ).bind(id, tenant.tenantId, data.email, data.nome, passwordHash, data.role, now, customRoleId, actor, actor).run()

  return c.json({ id, message: 'Usuário criado.' }, 201)
})

const userUpdateSchema = userSchema.partial().omit({ senha: true }).extend({
  ativo: z.boolean().optional(),
  customRoleId: z.string().uuid().nullable().optional(),
})

// PUT /api/tenant/info/usuarios/:id
app.put('/usuarios/:id', zValidator('json', userUpdateSchema), async (c) => {
  const tenant = c.get('tenant')
  const data = c.req.valid('json')
  const id = c.req.param('id')
  const now = new Date().toISOString()

  const cur = await c.env.DB_SHARED
    .prepare('SELECT role, custom_role_id FROM users WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first<{ role: string; custom_role_id: string | null }>()
  if (!cur) return c.json({ error: 'Usuário não encontrado.' }, 404)

  const nextRole = data.role ?? cur.role
  let nextCustom: string | null =
    data.customRoleId !== undefined ? data.customRoleId : cur.custom_role_id

  if (nextCustom) {
    const ok = await c.env.DB_SHARED
      .prepare('SELECT id FROM tenant_custom_roles WHERE id = ? AND tenant_id = ?')
      .bind(nextCustom, tenant.tenantId).first()
    if (!ok) return c.json({ error: 'Perfil personalizado inválido.' }, 400)
  } else {
    nextCustom = null
  }
  const finalCustom = nextRole === 'admin' ? null : nextCustom

  const fields = ['updated_at = ?', 'updated_by = ?']
  const vals: unknown[] = [now, auditUserId(c)]
  if (data.nome !== undefined) { fields.push('nome = ?'); vals.push(data.nome) }
  if (data.email !== undefined) { fields.push('email = ?'); vals.push(data.email) }
  if (data.role !== undefined) { fields.push('role = ?'); vals.push(data.role) }
  if (data.ativo !== undefined) { fields.push('ativo = ?'); vals.push(data.ativo ? 1 : 0) }
  if (data.customRoleId !== undefined || data.role !== undefined) {
    fields.push('custom_role_id = ?')
    vals.push(finalCustom)
  }

  await c.env.DB_SHARED.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`)
    .bind(...vals, id, tenant.tenantId).run()
  return c.json({ message: 'Usuário atualizado.' })
})

// DELETE /api/tenant/info/usuarios/:id
app.delete('/usuarios/:id', async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  if (user.userId === c.req.param('id')) return c.json({ error: 'Não é possível excluir seu próprio usuário.' }, 400)
  await c.env.DB_SHARED.prepare('DELETE FROM users WHERE id = ? AND tenant_id = ?')
    .bind(c.req.param('id'), tenant.tenantId).run()
  return c.json({ message: 'Usuário removido.' })
})

const subscriptionCheckoutSchema = z.object({
  plan: z.enum(['basico', 'pro', 'enterprise']),
})

// POST /api/tenant/info/subscription/checkout — sessão Stripe para upgrade (tenant ativo + usuário logado)
app.post('/subscription/checkout', zValidator('json', subscriptionCheckoutSchema), async (c) => {
  const tenant = c.get('tenant')
  const user = c.get('user')
  const { plan } = c.req.valid('json')

  const priceId = await resolvePriceIdForPlan(c.env, c.env.DB_SHARED, plan)
  if (!priceId) {
    return c.json({ error: 'Este plano não está configurado para checkout (Stripe).' }, 400)
  }

  const row = await c.env.DB_SHARED
    .prepare('SELECT slug, stripe_customer_id, stripe_subscription_id FROM tenants WHERE id = ?')
    .bind(tenant.tenantId)
    .first<{ slug: string; stripe_customer_id: string | null; stripe_subscription_id: string | null }>()

  if (!row) return c.json({ error: 'Tenant não encontrado.' }, 404)

  const u = await c.env.DB_SHARED
    .prepare('SELECT email FROM users WHERE id = ? AND tenant_id = ?')
    .bind(user.userId, tenant.tenantId)
    .first<{ email: string }>()

  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173'

  let subscriptionId = row.stripe_subscription_id
  if (!subscriptionId && row.stripe_customer_id) {
    try {
      subscriptionId = await findActiveSubscriptionId(c.env, row.stripe_customer_id)
    } catch (err) {
      console.error('[SubscriptionCheckout] list subscriptions:', err)
    }
  }

  if (subscriptionId) {
    try {
      const current = await fetchSubscription(c.env, subscriptionId)
      const itemId = current.items?.data?.[0]?.id
      if (!itemId) {
        return c.json({ error: 'Assinatura Stripe sem item para atualizar.' }, 500)
      }
      const params = new URLSearchParams({
        'items[0][id]': itemId,
        'items[0][price]': priceId,
        proration_behavior: 'create_prorations',
        'metadata[plan]': plan,
        'metadata[tenantSlug]': row.slug,
      })
      await stripeRequest(c.env, 'POST', `subscriptions/${subscriptionId}`, params)
      await applyStripeSubscriptionId(c.env, subscriptionId, { planHint: plan, customerHint: row.stripe_customer_id })
      return c.json({ updated: true, plan })
    } catch (err) {
      console.error('[SubscriptionCheckout] update subscription:', err)
      if (!row.stripe_customer_id) {
        return c.json({ error: err instanceof Error ? err.message : 'Erro ao trocar de plano.' }, 500)
      }
      const portalParams = new URLSearchParams({
        customer: row.stripe_customer_id,
        return_url: `${frontendUrl}/subscription-management`,
      })
      const portal = await stripeRequest<{ url: string }>(c.env, 'POST', 'billing_portal/sessions', portalParams)
      return c.json({ url: portal.url, via: 'portal' })
    }
  }

  const params = new URLSearchParams({
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    'success_url': `${frontendUrl}/checkout/success?tenant=${encodeURIComponent(row.slug)}`,
    'cancel_url': `${frontendUrl}/checkout/cancel`,
    'metadata[tenantSlug]': row.slug,
    'metadata[plan]': plan,
    'metadata[flow]': 'tenant_upgrade',
    'subscription_data[metadata][tenantSlug]': row.slug,
    'subscription_data[metadata][plan]': plan,
    'allow_promotion_codes': 'true',
  })

  if (row.stripe_customer_id) {
    params.set('customer', row.stripe_customer_id)
  } else if (u?.email) {
    params.set('customer_email', u.email)
  } else {
    return c.json({ error: 'Não foi possível identificar o e-mail para o checkout.' }, 400)
  }

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!stripeRes.ok) {
    const err = await stripeRes.json() as { error?: { message?: string } }
    console.error('[SubscriptionCheckout] Stripe error:', err)
    return c.json({ error: err.error?.message || 'Erro ao criar sessão de pagamento.' }, 500)
  }

  const session = await stripeRes.json() as { url: string; id: string }
  return c.json({ url: session.url, sessionId: session.id })
})

// POST /api/tenant/info/subscription/portal — abre o Stripe Customer Portal
app.post('/subscription/portal', async (c) => {
  const tenant = c.get('tenant')

  const tenantData = await c.env.DB_SHARED
    .prepare('SELECT stripe_customer_id, plan_id, status FROM tenants WHERE id = ?')
    .bind(tenant.tenantId)
    .first<{ stripe_customer_id: string | null; plan_id: string; status: string }>()

  if (!tenantData?.stripe_customer_id) {
    return c.json({ error: 'Nenhuma assinatura Stripe ativa para este tenant.' }, 404)
  }

  const frontendUrl = c.env.FRONTEND_URL || 'http://localhost:5173'

  const params = new URLSearchParams({
    customer: tenantData.stripe_customer_id,
    return_url: `${frontendUrl}/subscription-management`,
  })

  const portalRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!portalRes.ok) {
    const err = await portalRes.json() as { error?: { message?: string } }
    console.error('[Portal] Stripe error:', err)
    return c.json({ error: err.error?.message || 'Erro ao abrir portal de assinatura.' }, 500)
  }

  const portalSession = await portalRes.json() as { url: string }
  return c.json({ url: portalSession.url })
})

// GET /api/tenant/info/subscription — dados da assinatura atual
app.get('/subscription', async (c) => {
  const tenant = c.get('tenant')

  const base = await c.env.DB_SHARED
    .prepare(
      `SELECT t.plan_id, t.status, t.stripe_customer_id, t.subscription_expires_at
       FROM tenants t WHERE t.id = ?`,
    )
    .bind(tenant.tenantId)
    .first<{
      plan_id: string | null
      status: string
      stripe_customer_id: string | null
      subscription_expires_at: string | null
    }>()

  if (!base) return c.json({ error: 'Tenant não encontrado.' }, 404)

  const plan = await resolvePlanForTenant(c.env.DB_SHARED, tenant.tenantId)
  const uso = await getTenantUsage(c.env.DB_SHARED, tenant.tenantId)
  const docsMes = await getFiscalDocUsoMes(c.env.DB_SHARED, tenant.tenantId)

  const { results: caracteristicas } = await c.env.DB_SHARED
    .prepare(
      `SELECT rotulo, ordem FROM plan_caracteristicas WHERE plan_id = ? ORDER BY ordem ASC`,
    )
    .bind(plan.id)
    .all<{ rotulo: string; ordem: number }>()

  return c.json({
    subscription: {
      ...base,
      plan_id_efetivo: plan.id,
      plan_nome: plan.nome,
      preco_mensal: plan.preco_mensal,
      preco_anual: plan.preco_anual,
      max_empresas: plan.max_empresas,
      max_filiais: plan.max_filiais,
      max_usuarios: plan.max_usuarios,
      max_docs_fiscais_mes: plan.max_docs_fiscais_mes,
      max_emails_mes: plan.max_emails_mes,
      uso: { ...uso, docs_fiscais_mes: docsMes },
      caracteristicas: caracteristicas ?? [],
    },
  })
})

export default app
