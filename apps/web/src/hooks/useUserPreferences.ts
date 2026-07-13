import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'
import { generateScale, rgbTriple, deriveAccentTokens, SCALE_STEPS } from '../utils/colorScale'

export interface RecentItem {
  label: string
  to: string
  icon: string
}

export type HomeVariant = 'A' | 'B' | 'C'

export interface UserPreferences {
  accentColor: string
  sidebarMode: 'full' | 'icons' | 'hidden'
  homeLayout: 'grid' | 'list'
  theme: 'light' | 'dark' | 'system'
  density: 'compact' | 'normal' | 'comfortable'
  recentItemsCount: number
  recentItems: RecentItem[]
  visibleModules: string[]
  /** Home personalizável: variação ativa (Painel/Operacional/Compacto). */
  homeVariant: HomeVariant
  /** Ordem/composição de widgets por variação — chave ausente = default da variação. */
  homeLayouts: Partial<Record<HomeVariant, string[]>>
}

/** Ordem default dos widgets por variação — ver `components/home/widgetRegistry.ts`. */
export const DEFAULT_HOME_LAYOUTS: Record<HomeVariant, string[]> = {
  A: ['saldo', 'receber', 'pagar', 'vendas', 'grafico', 'vencimentos', 'atalhos', 'estoque', 'os'],
  B: ['atalhos', 'vencimentos', 'os', 'receber', 'pagar', 'saldo', 'grafico'],
  C: ['saldo', 'receber', 'pagar', 'vendas', 'vencimentos', 'estoque', 'recentes'],
}

const DEFAULT_PREFS: UserPreferences = {
  accentColor: '#4e6fdb',
  sidebarMode: 'icons',
  homeLayout: 'grid',
  theme: 'system',
  density: 'compact',
  recentItemsCount: 5,
  recentItems: [],
  visibleModules: [],
  homeVariant: 'A',
  homeLayouts: {},
}

function getLocalKey(): string {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return `user_prefs_${user.id || 'anon'}`
  } catch {
    return 'user_prefs_anon'
  }
}

/**
 * Mescla `partial` sobre `DEFAULT_PREFS` sem deixar `null`/`undefined`
 * sobrescrever um default válido — protege contra respostas antigas da
 * API (ou cache local) salvas antes de uma coluna nova ganhar valor
 * (ex.: `home_layouts` NULL em preferências criadas antes da migration
 * que a adicionou vira `null` na resposta, não `{}`).
 */
function withDefaults(partial: Partial<UserPreferences>): UserPreferences {
  const merged = { ...DEFAULT_PREFS }
  for (const key of Object.keys(partial) as (keyof UserPreferences)[]) {
    const value = partial[key]
    if (value !== null && value !== undefined) {
      (merged as Record<string, unknown>)[key] = value
    }
  }
  return merged
}

function readLocal(): UserPreferences {
  try {
    const raw = localStorage.getItem(getLocalKey())
    if (!raw) return DEFAULT_PREFS
    return withDefaults(JSON.parse(raw))
  } catch {
    return DEFAULT_PREFS
  }
}

function saveLocal(prefs: UserPreferences) {
  try {
    localStorage.setItem(getLocalKey(), JSON.stringify(prefs))
  } catch { /* noop */ }
}

/**
 * Aplica a cor de destaque escolhida pelo usuário como custom properties no
 * :root — a escala `--brand-50..950` (consumida pelas classes `bg-brand-*`
 * via `rgb(var(--brand-600) / <alpha-value>)` no tailwind.config.js) e os
 * tokens derivados `--tint-rgb`/`--acc-light`/`--acc-deep` usados em ícones
 * de hub, item ativo da sidebar e gradiente do avatar.
 */
function applyAccentColor(color: string) {
  const root = document.documentElement.style
  const scale = generateScale(color)
  for (const step of SCALE_STEPS) {
    root.setProperty(`--brand-${step}`, rgbTriple(scale[step]))
  }
  const { baseRgb, accLightHex, accDeepHex } = deriveAccentTokens(color)
  root.setProperty('--tint-rgb', baseRgb)
  root.setProperty('--acc-light', accLightHex)
  root.setProperty('--acc-deep', accDeepHex)
}

/** Aplica o tema (dark/light/system) no documento e sincroniza com useTheme */
function applyThemePref(theme: string) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
  // Sincroniza com a chave que useTheme usa no localStorage
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const key = `theme_${user.id || 'anon'}`
    localStorage.setItem(key, isDark ? 'dark' : 'light')
  } catch { /* noop */ }
}

export function useUserPreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(readLocal)
  const [loading, setLoading] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load from API on mount — aplica tema e cor de destaque
  useEffect(() => {
    api.get('/tenant/preferences')
      .then(res => {
        const merged = withDefaults(res.data)
        setPrefs(merged)
        saveLocal(merged)
        applyAccentColor(merged.accentColor)
        applyThemePref(merged.theme)
      })
      .catch(() => {
        // Fallback to local — ainda aplica preferências salvas
        const local = readLocal()
        applyAccentColor(local.accentColor)
        applyThemePref(local.theme)
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-aplica cor e tema sempre que mudarem
  useEffect(() => {
    applyAccentColor(prefs.accentColor)
  }, [prefs.accentColor])

  useEffect(() => {
    applyThemePref(prefs.theme)
  }, [prefs.theme])

  /** Update preferences with debounced API save */
  const updatePrefs = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      saveLocal(next)

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        api.put('/tenant/preferences', next).catch(() => { /* silent */ })
      }, 600)

      return next
    })
  }, [])

  /** Track a recently accessed item (deduplicated, capped by recentItemsCount) */
  const trackRecentItem = useCallback((item: RecentItem) => {
    setPrefs(prev => {
      const filtered = prev.recentItems.filter(r => r.to !== item.to)
      const updated = [item, ...filtered].slice(0, prev.recentItemsCount)
      const next = { ...prev, recentItems: updated }
      saveLocal(next)

      api.patch('/tenant/preferences/recent', { item, maxCount: prev.recentItemsCount })
        .catch(() => { /* silent */ })

      return next
    })
  }, [])

  return { prefs, loading, updatePrefs, trackRecentItem }
}
