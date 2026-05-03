import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { COMMAND_PALETTE_ITEMS, type CommandPaletteItem } from './registry';

function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

function matchesQuery(item: CommandPaletteItem, query: string): boolean {
  const q = normalizeSearch(query)
  if (!q) return true
  const hay = normalizeSearch([item.title, ...item.keywords].join(' '))
  const tokens = q.split(/\s+/).filter(Boolean)
  return tokens.every((t) => hay.includes(t))
}

function filterItems(
  items: CommandPaletteItem[],
  query: string,
  hasModuleAccess: (m: string) => boolean,
  hasModuleAction: (m: string, a: string) => boolean,
): CommandPaletteItem[] {
  return items.filter((it) => {
    if (it.module && !hasModuleAccess(it.module)) return false
    if (it.action && it.module) {
      if (!hasModuleAction(it.module, it.action)) return false
    }
    return matchesQuery(it, query)
  })
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const { hasModuleAccess, hasModuleAction } = usePermissions()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(
    () => filterItems(COMMAND_PALETTE_ITEMS, query, hasModuleAccess, hasModuleAction),
    [query, hasModuleAccess, hasModuleAction],
  )

  useEffect(() => {
    setHighlight(0)
  }, [query, visible.length])

  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlight(0)
      window.setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${highlight}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  const runSelect = useCallback(
    (item: CommandPaletteItem) => {
      navigate(item.path)
      onClose()
      setQuery('')
    },
    [navigate, onClose],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => Math.min(h + 1, Math.max(visible.length - 1, 0)))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => Math.max(h - 1, 0))
        return
      }
      if (e.key === 'Enter' && visible[highlight]) {
        e.preventDefault()
        runSelect(visible[highlight]!)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, visible, highlight, onClose, runSelect])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[min(15vh,120px)] px-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Fechar busca"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="relative w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-900/20 overflow-hidden"
      >
        <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-slate-400 flex-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              id="command-palette-title"
              type="search"
              autoComplete="off"
              placeholder="Buscar telas e ações…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-base outline-none"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
              esc
            </kbd>
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Navegação rápida · experimente &quot;cliente&quot;, &quot;nfs-e&quot;, &quot;estoque&quot;
          </p>
        </div>

        <div ref={listRef} className="max-h-[min(50vh,320px)] overflow-y-auto py-2">
          {visible.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhum resultado. Ajuste os termos ou verifique suas permissões.
            </div>
          ) : (
            visible.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                data-idx={idx}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => runSelect(item)}
                className={`w-full text-left px-4 py-2.5 text-sm flex flex-col gap-0.5 transition-colors ${
                  idx === highlight
                    ? 'bg-brand-50 dark:bg-brand-950/60 text-brand-900 dark:text-brand-100'
                    : 'text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                }`}
              >
                <span className="font-medium">{item.title}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">{item.path}</span>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex flex-wrap gap-3 text-[11px] text-slate-400 dark:text-slate-500">
          <span>
            <kbd className="font-mono px-1 rounded bg-slate-100 dark:bg-slate-800">↑</kbd>{' '}
            <kbd className="font-mono px-1 rounded bg-slate-100 dark:bg-slate-800">↓</kbd> navegar
          </span>
          <span>
            <kbd className="font-mono px-1 rounded bg-slate-100 dark:bg-slate-800">↵</kbd> abrir
          </span>
          <span className="hidden sm:inline opacity-70">
            Busca por conteúdo (ex.: número da nota) virá em versão futura.
          </span>
        </div>
      </div>
    </div>
  )
}
