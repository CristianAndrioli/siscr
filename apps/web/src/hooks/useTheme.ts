import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark';

function getUserThemeKey(): string {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const id = user.id || 'anon';
    return `theme_${id}`;
  } catch {
    return 'theme_anon';
  }
}

function readStoredTheme(): Theme {
  try {
    const key = getUserThemeKey();
    const stored = localStorage.getItem(key);
    if (stored === 'dark' || stored === 'light') return stored;
    // Fallback: preferência do sistema
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Hook para gerenciar o tema (light/dark) por usuário.
 * A preferência é salva no localStorage com chave `theme_${userId}`.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(getUserThemeKey(), theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggleTheme, isDark: theme === 'dark' };
}
