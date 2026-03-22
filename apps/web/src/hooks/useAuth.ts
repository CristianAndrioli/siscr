/**
 * Hook customizado para gerenciar autenticação
 */
import { useState, useEffect } from 'react';
import { authService, type TokenResponse } from '../services/auth';

interface User {
  token: string;
}

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<TokenResponse>;
  logout: () => void;
  loading: boolean;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
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

  const login = async (username: string, password: string): Promise<TokenResponse> => {
    return await authService.login(username, password);
  };

  const logout = (): void => {
    authService.logout();
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

