/**
 * Instância padrão da API (`/api`). Imports existentes: `import api from './api'`.
 */
import { createSiscrHttpClient } from './http/SiscrHttpClient'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

const api = createSiscrHttpClient({
  baseURL: `${API_BASE_URL}/api`,
})

export default api

