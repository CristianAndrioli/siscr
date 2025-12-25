import { ReactNode } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import AccessDenied from './AccessDenied';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteWithPermissionProps {
  children: ReactNode;
  requiredModule?: string;
  requiredPermission?: string;
  requiredAction?: string; // Ação específica no módulo (ex: 'view', 'add')
}

/**
 * Componente para proteger rotas baseado em permissões
 * Verifica se o usuário tem acesso ao módulo ou permissão específica
 */
export default function ProtectedRouteWithPermission({
  children,
  requiredModule,
  requiredPermission,
  requiredAction,
}: ProtectedRouteWithPermissionProps) {
  const { hasModuleAccess, hasPermission, hasModuleAction, loading } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" text="Verificando permissões..." />
      </div>
    );
  }

  // Verificar acesso ao módulo
  if (requiredModule) {
    if (requiredAction) {
      // Verificar ação específica no módulo
      if (!hasModuleAction(requiredModule, requiredAction)) {
        return (
          <AccessDenied
            title="Acesso Negado"
            message={`Você não tem permissão para ${requiredAction === 'view' ? 'visualizar' : requiredAction === 'add' ? 'criar' : requiredAction === 'change' ? 'editar' : requiredAction === 'delete' ? 'excluir' : 'acessar'} este módulo.`}
          />
        );
      }
    } else {
      // Verificar apenas acesso ao módulo
      if (!hasModuleAccess(requiredModule)) {
        return (
          <AccessDenied
            title="Acesso Negado"
            message="Você não tem acesso a este módulo."
          />
        );
      }
    }
  }

  // Verificar permissão específica
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <AccessDenied
        title="Acesso Negado"
        message="Você não tem permissão para acessar esta funcionalidade."
      />
    );
  }

  return <>{children}</>;
}

