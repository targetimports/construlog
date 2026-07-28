import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SemPermissao from '@/components/permissoes/SemPermissao';

function normalize(key) {
  return String(key || '').trim();
}

/**
 * RouteGuard Final: Verifica effectivePermissions contra permissionKey
 * - Exibe exatamente qual permissionKey faltou
 * - Log de acesso para auditoria
 */
export default function RouteGuardFinal({ 
  children, 
  requiredPermissionKey, 
  fallbackRoute = 'dashboard' 
}) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [effectivePerms, setEffectivePerms] = useState({});

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  useEffect(() => {
    if (!user || !requiredPermissionKey) {
      setChecking(false);
      return;
    }

    const checkPermission = async () => {
      try {
        // Obter effectivePermissions (fonte única)
        const response = await base44.functions.invoke('getEffectivePermissionsV2', {
          userId: user.email
        });

        const { effectivePermissions, role, basePermissionCount, overrideEnabled, overrideCount } = response.data;
        const normalizedKey = normalize(requiredPermissionKey);
        const hasPermission = effectivePermissions[normalizedKey] === true;

        setEffectivePerms(effectivePermissions);
        setAllowed(hasPermission);

        // Log DETALHADO para auditoria/debug
        console.log(`[RBAC] role=${role} required=${normalizedKey} has=${hasPermission} baseCount=${basePermissionCount} overrideEnabled=${overrideEnabled} overrideCount=${overrideCount}`, {
          user: user.email,
          timestamp: new Date().toISOString()
        });

        // Registrar tentativa
        try {
          await base44.functions.invoke('logAccessAttempt', {
            routePath: normalizedKey,
            requiredPermission: normalizedKey,
            allowed: hasPermission,
            effectivePermissionsCount: Object.keys(effectivePermissions).length,
            roleId: role,
            baseCount: basePermissionCount,
            overrideEnabled
          });
        } catch (err) {
          console.warn('[LOG ACCESS] error:', err);
        }
      } catch (error) {
        console.error('[ROUTE GUARD ERROR]', error);
        setAllowed(false);
      } finally {
        setChecking(false);
      }
    };

    checkPermission();
  }, [user, requiredPermissionKey]);

  // ANTI-FLICKER: nunca mostrar AccessDenied enquanto ainda verificando
  if (userLoading || checking) {
    return null;
  }

  if (!allowed) {
    if (import.meta.env.DEV) {
      console.warn(`[RouteGuardFinal AccessDenied] required=${requiredPermissionKey} user=${user?.email} route=${window.location.pathname}`);
    }
    return (
      <SemPermissao
        userRole={user?.perfil_acesso || 'campo'}
        requiredPermissionKey={requiredPermissionKey}
        availablePermissions={Object.keys(effectivePerms).filter(k => effectivePerms[k])}
      />
    );
  }

  return children;
}