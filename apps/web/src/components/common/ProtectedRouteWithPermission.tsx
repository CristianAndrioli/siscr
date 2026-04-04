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
        const verb =
          requiredAction === 'view'
            ? 'visualizar'
            : requiredAction === 'add'
              ? 'criar registros em'
              : requiredAction === 'change'
                ? 'editar dados em'
                : requiredAction === 'delete'
                  ? 'excluir dados em'
                  : 'acessar';
        return (
          <AccessDenied
            title="Acesso negado"
            message={`Você não tem permissão para ${verb} este módulo. Peça ao administrador para ajustar seu perfil ou permissão personalizada.`}
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

