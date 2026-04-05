import type { Context } from 'hono'
import type { Env } from '../index'

/** Retorna o id do usuário autenticado para `created_by` / `updated_by` (ou null). */
export function auditUserId(c: Context<{ Bindings: Env }>): string | null {
  const u = c.get('user')
  return u?.userId ?? null
}
