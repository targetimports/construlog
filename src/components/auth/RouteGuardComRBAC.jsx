import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import SemPermissaoMelhorado from '@/components/permissoes/SemPermissaoMelhorado';
import { getRequiredPermission } from '@/components/shared/permissionMap';

/**
 * RouteGuard com RBAC granular
 * - Verifica effectivePermissions contra requiredPermission
 * - Log de acesso e negações
 * - Redireciona para tela amigável se sem permissão
 */
export default function RouteGuardComRBAC({ children, routeId, fallbackRoute = 'dashboard' }) {
  const navigate = useNavigate();
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [availableRoutes, setAvailableRoutes] = useState([]);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
  });

  const requiredPermission = getRequiredPermission(routeId);

  // Verificar permissões efetivas
  useEffect(() => {
    if (!user) return;

    const checkPermission = async () => {
      try {
        // Chamar função para obter permissões efetivas
        const response = await base44.functions.invoke('getEffectivePermissions', {
          userId: user.email
        });

        const { effectivePermissions, role } = response.data;
        const allowed = effectivePermissions[requiredPermission] === true;

        // Log para debug
        console.log('[RBAC CHECK]', {
          user: user.email,
          role,
          routeId,
          requiredPermission,
          allowed,
          timestamp: new Date().toISOString()
        });

        // Calcular rotas disponíveis
        const available = Object.entries(effectivePermissions)
          .filter(([_, perm]) => perm === true)
          .map(([permKey]) => permissionKeyToRoute(permKey));

        setAvailableRoutes([...new Set(available)]);
        setHasPermission(allowed);
      } catch (error) {
        console.error('[RBAC ERROR]', error);
        setHasPermission(false);
      } finally {
        setPermissionsChecked(true);
      }
    };

    checkPermission();
  }, [user, requiredPermission, routeId]);

  // ANTI-FLICKER: null silencioso enquanto não verificou
  if (userLoading || !permissionsChecked) {
    return null;
  }

  // Sem permissão
  if (!hasPermission) {
    if (import.meta.env.DEV) {
      console.warn(`[RouteGuardComRBAC AccessDenied] routeId=${routeId} required=${requiredPermission} user=${user?.email}`);
    }
    return (
      <SemPermissaoMelhorado
        role={user?.perfil_acesso || user?.perfil_sistema || 'campo'}
        requiredPermission={requiredPermission}
        routePath={routeId}
        availableRoutes={availableRoutes}
      />
    );
  }

  // Com permissão
  return children;
}

/**
 * Converter permission key para route (mapa inverso)
 */
function permissionKeyToRoute(permKey) {
  const map = {
    'DASH_VIEW': 'dashboard',
    'LOG_ROUTES_VIEW': 'logistica-minhas-rotas',
    'LOG_TRIPS_VIEW': 'logistica-viagens',
    'LOG_REPORT_VIEW': 'logistica-relatorios',
    'LOG_FLEET_VIEW': 'logistica-frota',
    'LOG_DRIVERS_VIEW': 'logistica-motoristas',
    'LOG_TRACK_VIEW': 'logistica-rastreamento',
    'LOG_COST_VIEW': 'logistica-custos',
    'EQUIP_PANEL_VIEW': 'equipamentos-painel',
    'EQUIP_MANAGE_VIEW': 'equipamentos-gestao',
    'OBRAS_VIEW': 'obras',
    'SUPR_VIEW': 'suprimentos-requisicoes',
    'STOCK_VIEW': 'estoques-painel',
    'FIN_VIEW': 'financeiro-lancamentos',
    'RH_VIEW': 'rh-colaboradores',
  };
  return map[permKey] || 'dashboard';
}