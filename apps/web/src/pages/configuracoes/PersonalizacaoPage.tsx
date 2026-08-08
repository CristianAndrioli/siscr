import Layout from '../../components/Layout'
import { useUserPreferences } from '../../hooks/useUserPreferences'
import type { UserPreferences } from '../../hooks/useUserPreferences'
import { useTheme } from '../../hooks/useTheme'

const ALL_MODULES = [
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'faturamento', label: 'Faturamento' },
  { key: 'cadastros', label: 'Cadastros' },
  { key: 'estoque', label: 'Estoque' },
  { key: 'frota', label: 'Frota' },
  { key: 'configuracoes', label: 'Configurações' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</p>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        {children}
      </div>
    </div>
  )
}

function OptionGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; desc?: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
            value === opt.value
              ? 'bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300'
              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
          }`}
          title={opt.desc}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function PersonalizacaoPage() {
  const { prefs, updatePrefs } = useUserPreferences()
  const { setTheme } = useTheme()

  const handleTheme = (t: UserPreferences['theme']) => {
    updatePrefs({ theme: t })
    if (t !== 'system') setTheme(t)
    else {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(dark ? 'dark' : 'light')
    }
  }

  const toggleModule = (key: string) => {
    const current = prefs.visibleModules.length > 0
      ? prefs.visibleModules
      : ALL_MODULES.map(m => m.key)
    const has = current.includes(key)
    const updated = has ? current.filter(k => k !== key) : [...current, key]
    // If all selected, store empty array (= show all)
    updatePrefs({ visibleModules: updated.length === ALL_MODULES.length ? [] : updated })
  }

  const effectiveModules = prefs.visibleModules.length > 0
    ? prefs.visibleModules
    : ALL_MODULES.map(m => m.key)

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 font-display">Personalização</h1>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Ajuste a aparência e o layout do sistema. As preferências são salvas por usuário.
          </p>
        </div>

        {/* Tema */}
        <Section title="Tema">
          <OptionGroup
            value={prefs.theme}
            onChange={handleTheme}
            options={[
              { value: 'light', label: '☀️ Claro' },
              { value: 'dark', label: '🌙 Escuro' },
              { value: 'system', label: '💻 Sistema' },
            ]}
          />
        </Section>

        {/* Layout do Home */}
        <Section title="Layout do Home">
          <OptionGroup
            value={prefs.homeLayout}
            onChange={(v) => updatePrefs({ homeLayout: v })}
            options={[
              { value: 'grid', label: '⊞ Grade', desc: 'Módulos em grade 3 colunas' },
              { value: 'list', label: '≡ Lista', desc: 'Módulos em lista vertical' },
            ]}
          />
        </Section>

        {/* Itens recentes */}
        <Section title="Itens recentes no Home">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={3}
              max={10}
              step={1}
              value={prefs.recentItemsCount}
              onChange={e => updatePrefs({ recentItemsCount: Number(e.target.value) })}
              className="flex-1"
            />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums w-6 text-right">
              {prefs.recentItemsCount}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Número de páginas acessadas recentemente exibidas no Home.
          </p>
          {prefs.recentItems.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Histórico atual:</p>
              <div className="flex flex-wrap gap-2">
                {prefs.recentItems.map(item => (
                  <span
                    key={item.to}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  >
                    {item.label}
                  </span>
                ))}
              </div>
              <button
                onClick={() => updatePrefs({ recentItems: [] })}
                className="mt-3 text-xs text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 font-medium"
              >
                Limpar histórico
              </button>
            </div>
          )}
        </Section>

        {/* Módulos visíveis */}
        <Section title="Módulos visíveis no Home">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ALL_MODULES.map(mod => {
              const active = effectiveModules.includes(mod.key)
              return (
                <button
                  key={mod.key}
                  onClick={() => toggleModule(mod.key)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                    active
                      ? 'bg-brand-50 dark:bg-brand-950 border-brand-300 dark:border-brand-700 text-brand-700 dark:text-brand-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 line-through'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex-none flex items-center justify-center transition-colors ${
                    active
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {active && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  {mod.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
            Módulos desmarcados ficam ocultos na grade do Home. Você ainda pode acessá-los pela busca (⌘K).
          </p>
        </Section>
      </div>
    </Layout>
  )
}

export default PersonalizacaoPage
