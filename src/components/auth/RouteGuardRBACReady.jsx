import React from 'react';
import { useRBAC } from '@/components/shared/RBACContext';
import SemPermissao from '@/components/permissoes/SemPermissao';

/**
 * Route Guard com RBAC READY
 * - Aguarda rbacReady antes de negar
 * - Bypass para superadmin
 * - Log detalhado
 */
export default function RouteGuardRBACReady({ 
  children, 
  requiredPermissionKey 
}) {
  const { 
    user, 
    roleId, 
    effectivePermissions, 
    rbacReady, 
    isSuperAdmin, 
    isLoading,
    basePermissionCount,
    overrideEnabled,
    overrideCount
  } = useRBAC();

  // 1. ANTI-FLICKER: enquanto não está ready, retornar null silencioso
  if (!rbacReady || isLoading) {
    return null;
  }

  // 2. Se não tem user, negar
  if (!user) {
    return <SemPermissao userRole="Desconhecido" requiredPermissionKey={requiredPermissionKey} />;
  }

  // 3. Se superadmin, liberar (bypass)
  if (isSuperAdmin) {
    console.log(`[RBAC BYPASS] super=true role=${roleId} allow=true`);
    return children;
  }

  // 4. Se rota pública (sem requerimento), liberar
  if (!requiredPermissionKey) {
    return children;
  }

  // 5. Normalizar chave
  const normalizedKey = String(requiredPermissionKey || '').trim();

  // 6. Verificar permissão
  const hasPermission = effectivePermissions[normalizedKey] === true;

  // 7. Log detalhado
  console.log(
    `[RBAC] role=${roleId} super=${isSuperAdmin} ready=true required=${normalizedKey} has=${hasPermission} baseCount=${basePermissionCount} overrideEnabled=${overrideEnabled} overrideCount=${overrideCount}`
  );

  // 8. Se não tem permissão, mostrar erro
  if (!hasPermission) {
    return (
      <SemPermissao 
        userRole={roleId} 
        requiredPermissionKey={normalizedKey}
        availablePermissions={Object.keys(effectivePermissions).filter(k => effectivePermissions[k] === true)}
        debug={{
          rbacReady: true,
          baseCount: basePermissionCount,
          overrideEnabled,
          overrideCount
        }}
      />
    );
  }

  // 9. Permitir
  return children;
}