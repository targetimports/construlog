/**
 * ROUTE GUARD V2 - PADRÃO MODULO_ACAO
 * 
 * Usa APENAS effectivePermissionsV2 (novo padrão)
 * Fail-closed: sem permissão = sem acesso
 * 
 * Uso:
 * <RouteGuardFinalV2 requiredPermissionKey="OBRAS_CREATE">
 *   <YourComponent />
 * </RouteGuardFinalV2>
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useRBAC } from '../shared/RBACContext';
import { createPageUrl } from '@/utils';

// Quando a role não tem acesso à página, em vez de mostrar a tela vermelha
// "Acesso Negado", redireciona silenciosamente ao Dashboard (que todos podem ver).
const RedirectDashboard = () => <Navigate to={createPageUrl('Dashboard')} replace />;

export default function RouteGuardFinalV2({ 
  requiredPermissionKey, 
  children,
  fallback = null
}) {
  const { rbacReady, isLoading, effectivePermissionsV2, isSuperAdmin, isCompanyAdmin, perfilAcesso } = useRBAC();

  // ANTI-FLICKER: enquanto não está ready, nunca mostrar AccessDenied
  if (isLoading || !rbacReady) {
    return null; // skeleton silencioso — layout já mostra seu próprio loader
  }

  // Sem requisito = acesso público
  if (!requiredPermissionKey) {
    return <>{children}</>;
  }

  // Super admin = acesso total
  if (isSuperAdmin) {
    return <>{children}</>;
  }

  // Admin empresa = acesso total EXCETO ADMIN_CONFIG (TI)
  if (isCompanyAdmin) {
    const normalized = String(requiredPermissionKey).trim();
    if (normalized === 'ADMIN_CONFIG') {
      return fallback ?? <RedirectDashboard />;
    }
    return <>{children}</>;
  }

  // Verificar permissão — SOMENTE quando rbacReady=true
  const normalized = String(requiredPermissionKey).trim();
  const hasPermission = effectivePermissionsV2[normalized] === true;

  if (!hasPermission) {
    if (import.meta.env.DEV) {
      console.warn(`[GUARD AccessDenied] rbacReady=${rbacReady} role=${perfilAcesso} required=${normalized} route=${window.location.pathname}`);
    }
    return fallback ?? <SemPermissao requiredPermissionKey={normalized} userRole={perfilAcesso} />;
  }

  return <>{children}</>;
}