/**
 * Hook customizado para gerenciar autenticação
 * @returns {object} - { user, isAuthenticated, login, logout, loading }
 */
import { useState, useEffect } from 'react';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar se há token salvo
    const token = localStorage.getItem('access_token');
    if (token) {
      // Aqui você pode fazer uma chamada para verificar o token
      // Por enquanto, apenas verifica se existe
      setUser({ token }); // Simplificado - em produção, buscar dados do usuário
    }
    setLoading(false);
  }, []);

  const login = async (username, password) => {
    try {
      // Chamada de API para login
      const response = await fetch('/api/auth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Credenciais inválidas');
      }

      const data = await response.json();
      
      // Salvar tokens
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('refresh_token', data.refresh);
      
      setUser({ token: data.access });
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const isAuthenticated = !!user;

  return {
    user,
    isAuthenticated,
    login,
    logout,
    loading,
  };
}

