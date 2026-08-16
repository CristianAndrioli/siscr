import type { D1Database } from '@cloudflare/workers-types'
import { PasswordHasher } from './password'

const SEED_PASSWORD = '12345678'

const SEED_MASTERS = [
  {
    id: 'agent-cristian',
    nome: 'Cristian Andrioli',
    email: 'cristian.andrioli@siscr.com',
  },
  {
    id: 'agent-lucas',
    nome: 'Lucas Percisi',
    email: 'lucas.percisi@siscr.com',
  },
] as const

let seedPromise: Promise<void> | null = null

/**
 * Garante os dois masters iniciais. Idempotente.
 * A senha temporária é hasheada com PasswordHasher (nunca gravada em texto).
 */
export async function ensureSupportSeed(db: D1Database): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed(db).catch((err) => {
      seedPromise = null
      throw err
    })
  }
  await seedPromise
}

async function runSeed(db: D1Database): Promise<void> {
  const existing = await db
    .prepare('SELECT COUNT(*) as n FROM support_agents')
    .first<{ n: number }>()
  if ((existing?.n ?? 0) > 0) return

  const now = new Date().toISOString()
  const hash = await PasswordHasher.hash(SEED_PASSWORD)
  const stmts = SEED_MASTERS.map((agent) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO support_agents
          (id, nome, email, password_hash, role, ativo, must_change_password, created_at)
         VALUES (?, ?, ?, ?, 'master', 1, 1, ?)`,
      )
      .bind(agent.id, agent.nome, agent.email, hash, now),
  )
  await db.batch(stmts)
}
