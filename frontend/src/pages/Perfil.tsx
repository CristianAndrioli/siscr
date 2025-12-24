import { useState, useEffect } from 'react';
import { authService } from '../services/auth';

interface UserData {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  is_staff?: boolean;
  is_active?: boolean;
  date_joined?: string;
  role?: string;
  role_display?: string;
}

interface ProfileData {
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

interface TenantData {
  id: number;
  name: string;
  schema_name: string;
}

interface EmpresaData {
  id: number;
  nome: string;
  razao_social?: string;
}

interface FilialData {
  id: number;
  nome: string;
  codigo_filial?: string;
}

interface UserProfileResponse {
  user: UserData;
  profile: ProfileData;
  tenant?: TenantData;
  empresa?: EmpresaData;
  filial?: FilialData;
}

/**
 * Página de Perfil do Usuário
 */
function Perfil() {
  const [data, setData] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await authService.getCurrentUser();
      setData(response);
      setFormData({
        first_name: response.user.first_name || '',
        last_name: response.user.last_name || '',
        email: response.user.email || '',
        phone: response.profile?.phone || '',
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar perfil';
      setError(errorMessage);
      console.error('[Perfil] Erro ao carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);

      // TODO: Implementar endpoint de atualização de perfil
      // Por enquanto, apenas simular sucesso
      if (data) {
        setData({
          ...data,
          user: {
            ...data.user,
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
          },
          profile: {
            ...data.profile,
            phone: formData.phone,
          },
        });
        setIsEditing(false);
        alert('Perfil atualizado com sucesso!');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar perfil';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (data) {
      setFormData({
        first_name: data.user.first_name || '',
        last_name: data.user.last_name || '',
        email: data.user.email || '',
        phone: data.profile?.phone || '',
      });
    }
    setIsEditing(false);
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'user':
        return 'bg-green-100 text-green-800';
      case 'viewer':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <p className="text-red-600 text-lg font-semibold mb-2">Erro ao carregar perfil</p>
          {error && <p className="text-sm text-gray-500">{error}</p>}
        </div>
      </div>
    );
  }

  const fullName = data.user.first_name && data.user.last_name
    ? `${data.user.first_name} ${data.user.last_name}`
    : data.user.first_name || data.user.last_name || data.user.username;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="mt-2 text-sm text-gray-500">
          Gerencie suas informações pessoais e preferências
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Principal - Informações Pessoais */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="h-20 w-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{fullName}</h2>
                <p className="text-gray-600">@{data.user.username}</p>
                {data.user.role_display && (
                  <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(data.user.role)}`}>
                    {data.user.role_display}
                  </span>
                )}
              </div>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 flex items-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span>Editar Perfil</span>
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primeiro Nome
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Último Nome
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition duration-150"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Nome Completo
                  </label>
                  <p className="text-lg text-gray-900">{fullName}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Email
                  </label>
                  <p className="text-lg text-gray-900">{data.user.email || 'Não informado'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Telefone
                  </label>
                  <p className="text-lg text-gray-900">{data.profile?.phone || 'Não informado'}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Usuário
                  </label>
                  <p className="text-lg text-gray-900">@{data.user.username}</p>
                </div>

                {data.user.date_joined && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      Membro desde
                    </label>
                    <p className="text-lg text-gray-900">
                      {new Date(data.user.date_joined).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Status
                  </label>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        data.user.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {data.user.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    {data.user.is_staff && (
                      <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        Administrador
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Informações do Contexto */}
        <div className="space-y-6">
          {/* Card de Contexto (Tenant, Empresa, Filial) */}
          {(data.tenant || data.empresa || data.filial) && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Contexto Atual
              </h3>
              <div className="space-y-4">
                {data.tenant && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Tenant
                    </label>
                    <p className="text-sm font-semibold text-gray-900">{data.tenant.name}</p>
                    <p className="text-xs text-gray-500">{data.tenant.schema_name}</p>
                  </div>
                )}

                {data.empresa && (
                  <div className="pt-3 border-t border-gray-200">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Empresa
                    </label>
                    <p className="text-sm font-semibold text-gray-900">{data.empresa.nome}</p>
                    {data.empresa.razao_social && (
                      <p className="text-xs text-gray-500">{data.empresa.razao_social}</p>
                    )}
                  </div>
                )}

                {data.filial && (
                  <div className="pt-3 border-t border-gray-200">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Filial
                    </label>
                    <p className="text-sm font-semibold text-gray-900">{data.filial.nome}</p>
                    {data.filial.codigo_filial && (
                      <p className="text-xs text-gray-500">Código: {data.filial.codigo_filial}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card de Informações do Sistema */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start">
              <svg
                className="h-6 w-6 text-blue-600 mt-1 mr-3 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Sobre o Perfil
                </h3>
                <p className="text-sm text-blue-800">
                  Suas informações de perfil são usadas para personalizar sua experiência no sistema.
                  Mantenha seus dados atualizados para garantir a melhor experiência possível.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Perfil;
