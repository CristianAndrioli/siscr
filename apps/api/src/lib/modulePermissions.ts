export const MODULE_KEYS = [
  'cadastros',
  'financeiro',
  'faturamento',
  'estoque',
  'frota',
  'configuracoes',
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export type ModuleMatrix = Record<string, { view: boolean; edit: boolean }>

/** Matriz padrão por perfil do sistema (sem perfil personalizado). */
export function defaultModulesForRole(role: string): ModuleMatrix {
  const empty = (): ModuleMatrix =>
    Object.fromEntries(MODULE_KEYS.map((k) => [k, { view: false, edit: false }])) as ModuleMatrix

  if (role === 'admin') {
    const m = empty()
    for (const k of MODULE_KEYS) m[k] = { view: true, edit: true }
    return m
  }
  if (role === 'manager' || role === 'user') {
    const m = empty()
    for (const k of MODULE_KEYS) {
      if (k === 'configuracoes') m[k] = { view: false, edit: false }
      else m[k] = { view: true, edit: true }
    }
    return m
  }
  if (role === 'viewer') {
    const m = empty()
    for (const k of MODULE_KEYS) {
      if (k === 'configuracoes') m[k] = { view: false, edit: false }
      else m[k] = { view: true, edit: false }
    }
    return m
  }
  return empty()
}

export async function buildSessionModules(
  // D1Database
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: <T>() => Promise<T | null>; all: <T>() => Promise<{ results?: T[] | null }> } } },
  tenantId: string,
  role: string,
  customRoleId: string | null | undefined
): Promise<ModuleMatrix> {
  if (role === 'admin') {
    const m = {} as ModuleMatrix
    for (const k of MODULE_KEYS) m[k] = { view: true, edit: true }
    return m
  }

  if (customRoleId) {
    const owned = await db
      .prepare('SELECT id FROM tenant_custom_roles WHERE id = ? AND tenant_id = ?')
      .bind(customRoleId, tenantId)
      .first<{ id: string }>()
    if (!owned) {
      return defaultModulesForRole(role)
    }

    const { results } = await db
      .prepare(
        `SELECT module_key, can_view, can_edit FROM tenant_custom_role_modules
         WHERE tenant_id = ? AND custom_role_id = ?`
      )
      .bind(tenantId, customRoleId)
      .all<{ module_key: string; can_view: number; can_edit: number }>()

    const m = {} as ModuleMatrix
    for (const k of MODULE_KEYS) m[k] = { view: false, edit: false }
    for (const r of results ?? []) {
      if (MODULE_KEYS.includes(r.module_key as ModuleKey)) {
        m[r.module_key] = { view: r.can_view === 1, edit: r.can_edit === 1 }
      }
    }
    return m
  }

  return defaultModulesForRole(role)
}

export type SessionUserPayload = {
  userId: string
  email: string
  nome: string
  role: string
  tenantId: string
  tenantSlug: string
  empresaId: string | null
  filialId: string | null
  customRoleId: string | null
  modules: ModuleMatrix
}

export async function buildSessionUserPayload(
  db: Parameters<typeof buildSessionModules>[0],
  opts: {
    userId: string
    email: string
    nome: string
    role: string
    tenantId: string
    tenantSlug: string
    customRoleId: string | null | undefined
  }
): Promise<SessionUserPayload> {
  const modules = await buildSessionModules(db, opts.tenantId, opts.role, opts.customRoleId ?? null)
  return {
    userId: opts.userId,
    email: opts.email,
    nome: opts.nome,
    role: opts.role,
    tenantId: opts.tenantId,
    tenantSlug: opts.tenantSlug,
    empresaId: null,
    filialId: null,
    customRoleId: opts.customRoleId ?? null,
    modules,
  }
}
