const STORAGE_PREFIX = 'grid_prefs_v2_';

export const DEFAULT_GRID_PAGE_SIZE = 20;

export const GRID_PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200] as const;

export type GridPageSize = (typeof GRID_PAGE_SIZE_OPTIONS)[number];

export function normalizeGridPageSize(n: unknown): GridPageSize {
  if (typeof n === 'number' && (GRID_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) {
    return n as GridPageSize;
  }
  return DEFAULT_GRID_PAGE_SIZE;
}

export interface GridSort {
  key: string;
  dir: 'asc' | 'desc';
}

export interface GridPreferences {
  sort?: GridSort | null;
  filters?: Record<string, string>;
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
  visibleColumns?: string[];
  /** Quantidade de registos pedidos à API (grelhas que optam por limite). */
  pageSize?: number;
}

export function saveGridPreferences(gridId: string, prefs: GridPreferences): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${gridId}`, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

export function loadGridPreferences(gridId: string): GridPreferences | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${gridId}`);
    return raw ? (JSON.parse(raw) as GridPreferences) : null;
  } catch {
    return null;
  }
}

export function clearGridPreferences(gridId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${gridId}`);
  } catch {
    // ignore
  }
}
