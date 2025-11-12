/**
 * Utilitário para gerenciar preferências do grid por usuário
 * Salva no localStorage por enquanto (pode ser migrado para backend depois)
 */

const STORAGE_PREFIX = 'grid_prefs_';

export interface GridPreferences {
  columnWidths?: Record<string, number>;
  visibleColumns?: string[];
}

/**
 * Salva preferências do grid para um grid específico
 */
export function saveGridPreferences(gridId: string, preferences: GridPreferences): void {
  try {
    const key = `${STORAGE_PREFIX}${gridId}`;
    localStorage.setItem(key, JSON.stringify(preferences));
  } catch (error) {
    console.error('Erro ao salvar preferências do grid:', error);
  }
}

/**
 * Carrega preferências do grid
 */
export function loadGridPreferences(gridId: string): GridPreferences | null {
  try {
    const key = `${STORAGE_PREFIX}${gridId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Erro ao carregar preferências do grid:', error);
    return null;
  }
}

/**
 * Remove preferências do grid
 */
export function clearGridPreferences(gridId: string): void {
  try {
    const key = `${STORAGE_PREFIX}${gridId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Erro ao limpar preferências do grid:', error);
  }
}

