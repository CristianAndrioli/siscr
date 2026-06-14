import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'

export interface RecentItem {
  label: string
  to: string
  icon: string
}

export interface UserPreferences {
  accentColor: string
  sidebarMode: 'full' | 'icons' | 'hidden'
  homeLayout: 'grid' | 'list'
  theme: 'light' | 'dark' | 'system'
  density: 'compact' | 'normal' | 'comfortable'
  recentItemsCount: number
  recentItems: RecentItem[]
  visibleModules: string[]
}

const DEFAULT_PREFS: UserPreferences = {
  accentColor: '#4f46e5',
  sidebarMode: 'icons',
  homeLayout: 'grid',
  theme: 'system',
  density: 'normal',
  recentItemsCount: 5,
  recentItems: [],
  visibleModules: [],
}

function getLocalKey(): string {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    return `user_prefs_${user.id || 'anon'}`
  } catch {
    return 'user_prefs_anon'
  }
}

function readLocal(): UserPreferences {
  try {
    const raw = localStorage.getItem(getLocalKey())
    if (!raw) return DEFAULT_PREFS
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PREFS
  }
}

function saveLocal(prefs: UserPreferences) {
  try {
    localStorage.setItem(getLocalKey(), JSON.stringify(prefs))
  } catch { /* noop */ }
}

/** Aplica a cor de destaque como CSS custom property no :root */
function applyAccentColor(color: string) {
  document.documentElement.style.setProperty('--color-brand', color)
  // Also write as brand-600 equivalent used by Tailwind's arbitrary values
  document.documentElement.style.setProperty('--ac', color)
}

export function useUserPreferences() {
  const [prefs, setPrefs] = useState<UserPreferences>(readLocal)
  const [loading, setLoading] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load from API on mount
  useEffect(() => {
    api.get('/tenant/preferences')
      .then(res => {
        const merged = { ...DEFAULT_PREFS, ...res.data }
        setPrefs(merged)
        saveLocal(merged)
        applyAccentColor(merged.accentColor)
      })
      .catch(() => {
        // Fallback to local
        applyAccentColor(prefs.accentColor)
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync accent color whenever it changes
  useEffect(() => {
    applyAccentColor(prefs.accentColor)
  }, [prefs.accentColor])

  /** Update preferences with debounced API save */
  const updatePrefs = useCallback((patch: Partial<UserPreferences>) => {
    setPrefs(prev => {
      const next = { ...prev, ...patch }
      saveLocal(next)

      // Debounce API save by 600ms
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

      // Fire-and-forget patch to API
      api.patch('/tenant/preferences/recent', { item, maxCount: prev.recentItemsCount })
        .catch(() => { /* silent */ })

      return next
    })
  }, [])

  return { prefs, loading, updatePrefs, trackRecentItem }
}
