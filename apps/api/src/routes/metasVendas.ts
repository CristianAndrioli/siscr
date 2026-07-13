/**
 * routes/metasVendas.ts
 *
 * Metas de vendas por vendedor/período — prefixo /tenant/vendas
 * (montado ao lado de vendas.ts em index.ts, mesmo gate 'faturamento').
 *
 * "Realizado" é calculado a partir de pedidos_venda.status='faturado'
 * no período (por created_at — não há data_faturamento dedicada no
 * schema hoje).
 */

import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { Env } from '../index'
import { auditUserId } from '../lib/audit'

const app = new Hono<{ Bindings: Env }>()

app.get('/metas', async (c) => {
  const tenant = c.get('tenant')
  const now = new Date()
  const ano = Number(c.req.query('ano') ?? now.getFullYear())
  const mes = Number(c.req.query('mes') ?? now.getMonth() + 1)
  const mesStr = String(mes).padStart(2, '0')

  const { results: vendedores } = await c.env.DB_SHARED.prepare(`
    SELECT p.id, p.nome,
           m.id as meta_id, m.valor_meta,
           COALESCE((
             SELECT SUM(pv.total) FROM pedidos_venda pv
             WHERE pv.tenant_id = p.tenant_id AND pv.vendedor_id = p.id AND pv.status = 'faturado'
               AND strftime('%Y', pv.created_at) = ? AND strftime('%m', pv.created_at) = ?
           ), 0) as valor_realizado
    FROM pessoas p
    LEFT JOIN metas_vendas m ON m.vendedor_id = p.id AND m.tenant_id = p.tenant_id AND m.ano = ? AND m.mes = ?
    WHERE p.tenant_id = ? AND p.tipo_cadastro = 'vendedor' AND p.ativo = 1
    ORDER BY p.nome
  `).bind(String(ano), mesStr, ano, mes, tenant.tenantId).all()

  return c.json({ ano, mes, vendedores: vendedores ?? [] })
})

const metaSchema = z.object({
  vendedorId: z.string().uuid(),
  ano: z.number().int().min(2000).max(2100),
  mes: z.number().int().min(1).max(12),
  valorMeta: z.number().min(0),
})

app.put('/metas', zValidator('json', metaSchema), async (c) => {
  const tenant = c.get('tenant')
  const body = c.req.valid('json')
  const now = new Date().toISOString()
  const uid = auditUserId(c)

  const existing = await c.env.DB_SHARED
    .prepare('SELECT id FROM metas_vendas WHERE tenant_id = ? AND vendedor_id = ? AND ano = ? AND mes = ?')
    .bind(tenant.tenantId, body.vendedorId, body.ano, body.mes)
    .first<{ id: string }>()

  if (existing) {
    await c.env.DB_SHARED
      .prepare('UPDATE metas_vendas SET valor_meta = ?, updated_at = ?, updated_by = ? WHERE id = ?')
      .bind(body.valorMeta, now, uid, existing.id)
      .run()
  } else {
    await c.env.DB_SHARED
      .prepare(`
        INSERT INTO metas_vendas (id, tenant_id, vendedor_id, ano, mes, valor_meta, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(crypto.randomUUID(), tenant.tenantId, body.vendedorId, body.ano, body.mes, body.valorMeta, now, uid)
      .run()
  }

  return c.json({ message: 'Meta salva.' })
})

export default app
