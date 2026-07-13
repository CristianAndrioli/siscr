import { Hono } from 'hono'
import type { Env } from '../index'

const app = new Hono<{ Bindings: Env }>()

const DEFAULT_PREFS = {
  accentColor: '#4e6fdb',
  sidebarMode: 'icons',
  homeLayout: 'grid',
  theme: 'system',
  density: 'compact',
  recentItemsCount: 5,
  recentItems: [] as RecentItem[],
  visibleModules: [] as string[],
  homeVariant: 'A',
  homeLayouts: {} as Record<string, string[]>,
}

interface RecentItem {
  label: string
  to: string
  icon: string
}

// GET /api/tenant/preferences
app.get('/', async (c) => {
  const user = c.get('user')
  const row = await c.env.DB_SHARED
    .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
    .bind(user.userId)
    .first<Record<string, unknown>>()

  if (!row) {
    return c.json(DEFAULT_PREFS)
  }

  return c.json({
    accentColor: row.accent_color ?? DEFAULT_PREFS.accentColor,
    sidebarMode: row.sidebar_mode ?? DEFAULT_PREFS.sidebarMode,
    homeLayout: row.home_layout ?? DEFAULT_PREFS.homeLayout,
    theme: row.theme ?? DEFAULT_PREFS.theme,
    density: row.density ?? DEFAULT_PREFS.density,
    recentItemsCount: row.recent_items_count ?? DEFAULT_PREFS.recentItemsCount,
    recentItems: safeJson(row.recent_items as string, []),
    visibleModules: safeJson(row.visible_modules as string, []),
    homeVariant: row.home_variant ?? DEFAULT_PREFS.homeVariant,
    homeLayouts: safeJson(row.home_layouts as string, DEFAULT_PREFS.homeLayouts),
  })
})

// PUT /api/tenant/preferences
app.put('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json<Partial<typeof DEFAULT_PREFS & { recentItems: RecentItem[]; visibleModules: string[] }>>()

  const now = new Date().toISOString()

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO user_preferences
        (user_id, tenant_id, accent_color, sidebar_mode, home_layout, theme, density,
         recent_items_count, recent_items, visible_modules, home_variant, home_layouts, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        accent_color       = excluded.accent_color,
        sidebar_mode       = excluded.sidebar_mode,
        home_layout        = excluded.home_layout,
        theme              = excluded.theme,
        density            = excluded.density,
        recent_items_count = excluded.recent_items_count,
        recent_items       = excluded.recent_items,
        visible_modules    = excluded.visible_modules,
        home_variant       = excluded.home_variant,
        home_layouts       = excluded.home_layouts,
        updated_at         = excluded.updated_at
    `)
    .bind(
      user.userId,
      user.tenantId,
      body.accentColor ?? DEFAULT_PREFS.accentColor,
      body.sidebarMode ?? DEFAULT_PREFS.sidebarMode,
      body.homeLayout ?? DEFAULT_PREFS.homeLayout,
      body.theme ?? DEFAULT_PREFS.theme,
      body.density ?? DEFAULT_PREFS.density,
      body.recentItemsCount ?? DEFAULT_PREFS.recentItemsCount,
      JSON.stringify(body.recentItems ?? []),
      JSON.stringify(body.visibleModules ?? []),
      body.homeVariant ?? DEFAULT_PREFS.homeVariant,
      JSON.stringify(body.homeLayouts ?? {}),
      now,
    )
    .run()

  return c.json({ ok: true })
})

// PATCH /api/tenant/preferences/recent — append one recent item
app.patch('/recent', async (c) => {
  const user = c.get('user')
  const { item, maxCount } = await c.req.json<{ item: RecentItem; maxCount?: number }>()

  const row = await c.env.DB_SHARED
    .prepare('SELECT recent_items, recent_items_count FROM user_preferences WHERE user_id = ?')
    .bind(user.userId)
    .first<{ recent_items: string; recent_items_count: number }>()

  const max = maxCount ?? row?.recent_items_count ?? 5
  const existing: RecentItem[] = safeJson(row?.recent_items ?? '[]', [])

  // Remove duplicates of the same route, prepend new item
  const filtered = existing.filter(r => r.to !== item.to)
  const updated = [item, ...filtered].slice(0, max)

  await c.env.DB_SHARED
    .prepare(`
      INSERT INTO user_preferences (user_id, tenant_id, recent_items, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        recent_items = excluded.recent_items,
        updated_at   = excluded.updated_at
    `)
    .bind(user.userId, user.tenantId, JSON.stringify(updated), new Date().toISOString())
    .run()

  return c.json({ recentItems: updated })
})

function safeJson<T>(raw: string, fallback: T): T {
  try { return JSON.parse(raw) } catch { return fallback }
}

export default app
