/**
 * Service para autenticação
 */
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const authService = {
  /**
   * Realiza login e retorna tokens
   * @param {string} username - Usuário
   * @param {string} password - Senha
   * @returns {Promise<object>} - { access, refresh }
   */
  login: async (username, password) => {
    const response = await axios.post(`${API_BASE_URL}/api/auth/token/`, {
      username,
      password,
    });
    
    const { access, refresh } = response.data;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    
    return { access, refresh };
  },

  /**
   * Realiza logout (remove tokens)
   */
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  },

  /**
   * Obtém token de acesso atual
   * @returns {string|null} - Token ou null
   */
  getToken: () => {
    return localStorage.getItem('access_token');
  },

  /**
   * Verifica se usuário está autenticado
   * @returns {boolean} - True se autenticado
   */
  isAuthenticated: () => {
    return !!localStorage.getItem('access_token');
  },

  /**
   * Atualiza token de acesso usando refresh token
   * @returns {Promise<string>} - Novo access token
   */
  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('Refresh token não encontrado');
    }

    const response = await axios.post(`${API_BASE_URL}/api/auth/token/refresh/`, {
      refresh: refreshToken,
    });

    const { access } = response.data;
    localStorage.setItem('access_token', access);
    return access;
  },

  /**
   * Verifica se token é válido
   * @returns {Promise<boolean>} - True se válido
   */
  verifyToken: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) return false;

    try {
      await axios.post(`${API_BASE_URL}/api/auth/token/verify/`, {
        token,
      });
      return true;
    } catch (error) {
      return false;
    }
  },
};

