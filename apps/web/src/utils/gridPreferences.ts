const STORAGE_PREFIX = 'grid_prefs_v2_';

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
