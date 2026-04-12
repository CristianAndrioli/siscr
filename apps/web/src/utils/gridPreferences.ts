const STORAGE_PREFIX = 'grid_prefs_v2_';

export const DEFAULT_GRID_PAGE_SIZE = 10;

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
  /** Quantidade de registos pedidos à API (grelhas paginadas no servidor). */
  pageSize?: number;
  /** Página actual (0-based), grelhas com paginação no servidor. */
  listPage?: number;
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

/** Página guardada para uma grelha (0-based). */
export function loadGridListPage(gridId: string): number {
  const p = loadGridPreferences(gridId);
  const n = p?.listPage;
  return typeof n === 'number' && n >= 0 ? n : 0;
}

export function clearGridPreferences(gridId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${gridId}`);
  } catch {
    // ignore
  }
}
