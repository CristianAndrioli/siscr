import { useState, useEffect, useCallback, useRef } from 'react'
import { authService } from '../services/auth'
import Layout from '../components/Layout'
import api from '../services/api'
import { fmtBRL } from '../utils/format'
import { useUserPreferences, DEFAULT_HOME_LAYOUTS } from '../hooks/useUserPreferences'
import type { HomeVariant } from '../hooks/useUserPreferences'
import { WIDGET_REGISTRY, ALL_WIDGET_KEYS, type WidgetKey } from '../components/home/widgetRegistry'
import { renderWidget, type FinDash } from '../components/home/HomeWidgets'
import { icons, Icon } from '../components/icons'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function todayFormatted() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

const VARIANTS: { key: HomeVariant; label: string }[] = [
  { key: 'A', label: 'Painel' },
  { key: 'B', label: 'Operacional' },
  { key: 'C', label: 'Compacto' },
]

function AppHome() {
  const [userName, setUserName] = useState('')
  const [dash, setDash] = useState<FinDash | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const dragKeyRef = useRef<WidgetKey | null>(null)
  const { prefs, updatePrefs } = useUserPreferences()

  useEffect(() => {
    const nome = localStorage.getItem('user_nome')
    if (nome) setUserName(nome)
    else {
      const u = authService.getLocalUser()
      setUserName(u?.nome || u?.email || '')
    }

    api.get('/tenant/financeiro/dashboard')
      .then(res => setDash(res.data))
      .catch(() => setDash(null))
      .finally(() => setLoading(false))
  }, [])

  const variant = prefs.homeVariant
  const order = prefs.homeLayouts[variant] ?? DEFAULT_HOME_LAYOUTS[variant]
  const galleryKeys = ALL_WIDGET_KEYS.filter(k => !order.includes(k))

  const saveOrder = useCallback((next: string[]) => {
    updatePrefs({ homeLayouts: { ...prefs.homeLayouts, [variant]: next } })
  }, [prefs.homeLayouts, updatePrefs, variant])

  const handleRemove = (key: WidgetKey) => saveOrder(order.filter(k => k !== key))
  const handleAdd = (key: WidgetKey) => saveOrder([...order, key])

  const handleDrop = (targetKey: WidgetKey) => {
    const dragKey = dragKeyRef.current
    if (!dragKey || dragKey === targetKey) return
    const next = order.filter(k => k !== dragKey)
    const idx = next.indexOf(targetKey)
    next.splice(idx, 0, dragKey)
    saveOrder(next)
    dragKeyRef.current = null
  }

  const receber = dash?.receber
  const pagar = dash?.pagar
  const totalVencido = (receber?.vencido ?? 0) + (pagar?.vencido ?? 0)
  const qtdVencido = (receber?.qtd_vencido ?? 0) + (pagar?.qtd_vencido ?? 0)

  return (
    <Layout>
      <div className="max-w-[1160px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500 capitalize">{todayFormatted()}</p>
            <h1 className="text-[27px] font-bold text-slate-800 dark:text-slate-100 font-display mt-0.5">
              {greeting()}, {userName ? userName.split(' ')[0] : 'Usuário'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 p-0.5 rounded-control bg-slate-100 dark:bg-slate-800">
              {VARIANTS.map(v => (
                <button
                  key={v.key}
                  onClick={() => updatePrefs({ homeVariant: v.key })}
                  className={`px-3 h-8 rounded-[7px] text-xs font-semibold transition-colors ${
                    variant === v.key
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => setEditMode(e => !e)}
              className={editMode ? 'btn-primary' : 'btn-secondary'}
            >
              <Icon d={editMode ? icons.check : icons.gear} className="w-4 h-4" />
              {editMode ? 'Concluir edição' : 'Personalizar'}
            </button>
          </div>
        </div>

        {/* Alerta de vencidos */}
        {!loading && qtdVencido > 0 && (
          <div className="flex gap-3 items-start bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-card px-4 py-3.5">
            <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {qtdVencido} título(s) vencido(s) — {fmtBRL(totalVencido)} em aberto
            </p>
          </div>
        )}

        {/* Grade de widgets — 12 colunas no desktop (reduzido em telas
            menores via .home-widget em index.css), editável com drag-and-drop */}
        <div className="grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-12 gap-3.5">
          {order.map(rawKey => {
            const key = rawKey as WidgetKey
            const meta = WIDGET_REGISTRY[key]
            if (!meta) return null
            const span = meta.span[variant]
            return (
              <div
                key={key}
                draggable={editMode}
                onDragStart={() => { dragKeyRef.current = key }}
                onDragOver={e => editMode && e.preventDefault()}
                onDrop={() => editMode && handleDrop(key)}
                className={`home-widget relative min-w-0 ${editMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{
                  '--span-desktop': span,
                  '--span-tablet': Math.min(6, Math.max(2, Math.ceil(span / 2))),
                  '--span-mobile': span <= 4 ? 1 : 2,
                } as React.CSSProperties}
              >
                {editMode && (
                  <>
                    <div className="absolute -inset-[5px] rounded-[17px] border-2 border-dashed border-brand-400 pointer-events-none z-10" />
                    <button
                      onClick={() => handleRemove(key)}
                      className="absolute -top-2 -right-2 z-20 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm"
                      title="Remover widget"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                )}
                {renderWidget(key, dash, loading, prefs.recentItems)}
              </div>
            )
          })}
        </div>

        {/* Galeria de widgets — só no modo edição */}
        {editMode && galleryKeys.length > 0 && (
          <div className="rounded-card border-2 border-dashed border-slate-300 dark:border-slate-700 p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 mb-3">
              Galeria de widgets
            </p>
            <div className="flex flex-wrap gap-2">
              {galleryKeys.map(key => (
                <button
                  key={key}
                  onClick={() => handleAdd(key)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                >
                  <Icon d={icons.plus} className="w-3.5 h-3.5" />
                  {WIDGET_REGISTRY[key].title}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  )
}

export default AppHome
