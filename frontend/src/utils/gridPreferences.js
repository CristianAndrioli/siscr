/**
 * Utilitário para gerenciar preferências do grid por usuário
 * Salva no localStorage por enquanto (pode ser migrado para backend depois)
 */

const STORAGE_PREFIX = 'grid_prefs_';

/**
 * Salva preferências do grid para um grid específico
 * @param {string} gridId - ID único do grid (ex: 'pessoas', 'produtos')
 * @param {Object} preferences - Preferências { columnWidths, visibleColumns }
 */
export function saveGridPreferences(gridId, preferences) {
  try {
    const key = `${STORAGE_PREFIX}${gridId}`;
    localStorage.setItem(key, JSON.stringify(preferences));
  } catch (error) {
    console.error('Erro ao salvar preferências do grid:', error);
  }
}

/**
 * Carrega preferências do grid
 * @param {string} gridId - ID único do grid
 * @returns {Object|null} - Preferências ou null se não existir
 */
export function loadGridPreferences(gridId) {
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
 * @param {string} gridId - ID único do grid
 */
export function clearGridPreferences(gridId) {
  try {
    const key = `${STORAGE_PREFIX}${gridId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Erro ao limpar preferências do grid:', error);
  }
}

