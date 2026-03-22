import { Hono } from 'hono'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

// GET /api/subscriptions/plans — lista planos (rota pública)
app.get('/plans', async (c) => {
  const { results } = await c.env.DB_SHARED
    .prepare('SELECT id, nome, preco_mensal, preco_anual, max_empresas, max_filiais, max_usuarios, features FROM plans WHERE ativo = 1 ORDER BY preco_mensal')
    .all()

  return c.json({ plans: results })
})

export default app
