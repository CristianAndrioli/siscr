import { Hono } from 'hono'
import type { Env } from '../index'

/**
 * Proxies leves para ViaCEP e IBGE (CNAE), evitando CORS no browser e reutilizando o mesmo host da API.
 */
const app = new Hono<{ Bindings: Env }>()

// GET /api/public/cep/:cep — repassa ViaCEP (JSON bruto)
app.get('/cep/:cep', async (c) => {
  const digits = (c.req.param('cep') ?? '').replace(/\D/g, '').slice(0, 8)
  if (digits.length !== 8) {
    return c.json({ erro: true, message: 'CEP deve ter 8 dígitos.' }, 400)
  }
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
    if (!res.ok) return c.json({ erro: true }, 502)
    const data = (await res.json()) as Record<string, unknown>
    return c.json(data)
  } catch {
    return c.json({ erro: true }, 502)
  }
})

// GET /api/public/cnae/:codigo — repassa subclasse CNAE (IBGE v2)
app.get('/cnae/:codigo', async (c) => {
  const cod = (c.req.param('codigo') ?? '').replace(/\D/g, '').slice(0, 7)
  if (cod.length !== 7) {
    return c.json({ message: 'Código CNAE deve ter 7 dígitos.' }, 400)
  }
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v2/cnae/subclasses/${encodeURIComponent(cod)}`,
    )
    if (res.status === 404) return c.json({ message: 'Não encontrado.' }, 404)
    if (!res.ok) return c.json({ message: 'Erro ao consultar IBGE.' }, 502)
    const data = await res.json()
    return c.json(data)
  } catch {
    return c.json({ message: 'Erro ao consultar IBGE.' }, 502)
  }
})

export default app
