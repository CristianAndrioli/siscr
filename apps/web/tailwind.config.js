/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Acento configurável pelo tenant (Personalização) — cada step vira uma
        // custom property em :root, atualizada em runtime por `applyAccentColor()`
        // (ver useUserPreferences.ts + utils/colorScale.ts). O valor padrão em
        // :root cobre o primeiro paint antes do React montar.
        brand: {
          50:  'rgb(var(--brand-50) / <alpha-value>)',
          100: 'rgb(var(--brand-100) / <alpha-value>)',
          200: 'rgb(var(--brand-200) / <alpha-value>)',
          300: 'rgb(var(--brand-300) / <alpha-value>)',
          400: 'rgb(var(--brand-400) / <alpha-value>)',
          500: 'rgb(var(--brand-500) / <alpha-value>)',
          600: 'rgb(var(--brand-600) / <alpha-value>)',
          700: 'rgb(var(--brand-700) / <alpha-value>)',
          800: 'rgb(var(--brand-800) / <alpha-value>)',
          900: 'rgb(var(--brand-900) / <alpha-value>)',
          950: 'rgb(var(--brand-950) / <alpha-value>)',
        },
        // Redesign "cockpit financeiro": neutros papel-quente (claro) / grafite (escuro)
        // substituem o slate azulado padrão do Tailwind — cascata automática para
        // toda a UI já escrita com bg-slate-*/text-slate-*/border-slate-*.
        slate: {
          50:  '#f4f3ee',
          100: '#eeece3',
          200: '#e3e1d8',
          300: '#c7c4b7',
          400: '#8b948f',
          500: '#667077',
          600: '#4f5a5f',
          700: '#383f43',
          800: '#272e31',
          900: '#191d20',
          950: '#0e1113',
        },
        surface: {
          DEFAULT: '#0e1113',
          card:    '#171c1f',
          border:  '#272e31',
          muted:   '#8b948f',
        },
        sidebar: {
          DEFAULT: '#11161a',
          border:  '#232a2e',
          divider: '#1c2327',
          text:    '#9aa69f',
          section: '#4d5854',
          hover:   '#1a2126',
        },
        positive: { DEFAULT: '#0c7a55', dark: '#5ad4a6' },
        negative: '#e25b4e',
        warn: { DEFAULT: '#e8a33d', bg: '#fdf0e4', text: '#b96f18' },
      },
      borderRadius: {
        card: '14px',
        tile: '12px',
        control: '9px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        pop:  '0 4px 16px -2px rgb(15 23 42 / 0.12), 0 2px 4px -2px rgb(15 23 42 / 0.08)',
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, rgb(var(--brand-600)) 0%, var(--acc-deep, rgb(var(--brand-800))) 100%)',
        'gradient-dark':  'linear-gradient(135deg, #0e1113 0%, #171c1f 100%)',
        'gradient-card':  'linear-gradient(135deg, #171c1f 0%, #0e1113 100%)',
      },
      animation: {
        'fade-in':   'fadeIn 0.5s ease-out',
        'slide-up':  'slideUp 0.6s ease-out',
        'slide-in':  'slideIn 0.3s ease-out',
        'fade-up':   'fadeUp 350ms ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideIn: { from: { opacity: '0', transform: 'translateX(100%)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        fadeUp:  { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
