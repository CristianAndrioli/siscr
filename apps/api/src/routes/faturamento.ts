import { Hono } from 'hono'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// GET /api/tenant/faturamento/notas
app.get('/notas', async (c) => {
  const tenant = c.get('tenant')
  const { empresaId, filialId, status, tipo } = c.req.query()

  let query = `
    SELECT nf.id, nf.numero, nf.tipo, nf.status, nf.chave_acesso, nf.valor_total, nf.created_at,
           p.nome as destinatario
    FROM notas_fiscais nf
    LEFT JOIN pessoas p ON p.id = nf.destinatario_id
    WHERE nf.tenant_id = ?
  `
  const params: unknown[] = [tenant.tenantId]

  if (empresaId) { query += ' AND nf.empresa_id = ?'; params.push(empresaId) }
  if (filialId) { query += ' AND nf.filial_id = ?'; params.push(filialId) }
  if (status) { query += ' AND nf.status = ?'; params.push(status) }
  if (tipo) { query += ' AND nf.tipo = ?'; params.push(tipo) }

  query += ' ORDER BY nf.created_at DESC LIMIT 100'

  const { results } = await c.env.DB_SHARED.prepare(query).bind(...params).all()
  return c.json({ notas: results })
})

// GET /api/tenant/faturamento/notas/:id/xml
// Retorna o XML da NF-e armazenado no R2
app.get('/notas/:id/xml', async (c) => {
  const tenant = c.get('tenant')
  const id = c.req.param('id')

  const nota = await c.env.DB_SHARED
    .prepare('SELECT xml_path, chave_acesso FROM notas_fiscais WHERE id = ? AND tenant_id = ?')
    .bind(id, tenant.tenantId)
    .first<{ xml_path: string; chave_acesso: string }>()

  if (!nota?.xml_path) return c.json({ error: 'XML não disponível.' }, 404)

  const object = await c.env.R2_STORAGE.get(nota.xml_path)
  if (!object) return c.json({ error: 'Arquivo XML não encontrado.' }, 404)

  const xml = await object.text()
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="${nota.chave_acesso}.xml"`,
    },
  })
})

// POST /api/tenant/faturamento/notas/:id/cancelar
app.post('/notas/:id/cancelar', async (c) => {
  const tenant = c.get('tenant')
  const { motivo } = await c.req.json<{ motivo: string }>()

  await c.env.DB_SHARED
    .prepare('UPDATE notas_fiscais SET status = ?, motivo_cancelamento = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
    .bind('cancelada', motivo, new Date().toISOString(), c.req.param('id'), tenant.tenantId)
    .run()

  return c.json({ message: 'Nota fiscal cancelada.' })
})

export default app
