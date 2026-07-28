import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { isSuperAdminProfile } from './defaultPermissions';
import { getRoleDefaults, isSuperAdminRole, canAccessModule } from './rbacRoleDefaults';

const RBACContext = createContext({
  user: null,
  roleId: null,
  perfilAcesso: null,
  effectivePermissions: {},
  rbacReady: false,
  isSuperAdmin: false,
  isLoading: true,
  error: null,
  refetch: () => {}
});

export function RBACProvider({ children }) {
        const [rbacReady, setRbacReady] = useState(false);
        const [isSuperAdmin, setIsSuperAdmin] = useState(false);

        // Fetch user
        const { data: user, isLoading: userLoading, refetch: refetchUser } = useQuery({
          queryKey: ['rbac-user'],
          queryFn: () => base44.auth.me(),
          staleTime: Infinity,
          retry: 1
        });

        // Fetch effective permissions com FALLBACK FAIL-CLOSED
        const { data: permData, isLoading: permLoading, refetch: refetchPerms } = useQuery({
        queryKey: ['rbac-permissions', user?.email],
        queryFn: async () => {
          if (!user?.email) return null;

          const perfilAcesso = user.perfil_acesso || user.perfil_sistema || user.role;

          // Super admin: bypass LOCAL (nunca depende de dados externos)
          if (isSuperAdminProfile(perfilAcesso)) {
            console.log(`[RBAC] Super admin (${perfilAcesso}): bypass total`);
            return {
              effectivePermissionsV2: { 'ADMIN_CONFIG': true, 'PROFILE_EDIT': true },
              isSuperAdmin: true,
              source: 'super_admin_bypass'
            };
          }

          // Tentar buscar do backend (novo padrão V2)
          try {
            const res = await base44.functions.invoke('getEffectivePermissionsV2', {
              userId: user.email,
              perfilAcesso
            });

            // Usar APENAS effectivePermissionsV2 (novo padrão)
            if (res.data?.effectivePermissionsV2) {
              return {
                effectivePermissionsV2: res.data.effectivePermissionsV2,
                isSuperAdmin: res.data.isSuperAdmin || false,
                isCompanyAdmin: res.data.isCompanyAdmin || false,
                source: res.data.source || 'backend',
                fallback: false
              };
            }

            throw new Error('API não retornou effectivePermissionsV2');
          } catch (err) {
            // Fallback FAIL-CLOSED: permissões MÍNIMAS
            console.warn(`[RBAC FALLBACK] Erro ao buscar perms: ${err.message}`);

            // Super admin recebe bypass mínimo
            if (isSuperAdminRole(perfilAcesso)) {
              return {
                effectivePermissionsV2: { 'ADMIN_CONFIG': true, 'PROFILE_EDIT': true },
                isSuperAdmin: true,
                source: 'fallback_super_admin',
                fallback: true
              };
            }

            // Outros recebem APENAS PROFILE_EDIT (fail-closed)
            return {
              effectivePermissionsV2: { 'PROFILE_EDIT': true },
              isSuperAdmin: false,
              isCompanyAdmin: false,
              source: 'fallback_minimal',
              fallback: true
            };
          }
        },
        enabled: !!user?.email,
        staleTime: 300000, // 5 min
        retry: 1
        });

  // Quando user muda, atualizar isSuperAdmin
  useEffect(() => {
  if (!user) {
    setIsSuperAdmin(false);
    return;
  }

  const perfilAcesso = user.perfil_acesso || user.perfil_sistema || user.role;
  // Apenas verificação LOCAL por perfil — nunca derivado de dados externos
  const isSuper = isSuperAdminProfile(perfilAcesso) || user.isOwner === true;

  setIsSuperAdmin(isSuper);
  }, [user]);

  // Quando dados estão prontos, marcar READY
  useEffect(() => {
  const ready = !userLoading && !permLoading && !!user && !!permData;
  setRbacReady(ready);
  }, [user, permData, userLoading, permLoading]);

  const perfilAcesso = user?.perfil_acesso || user?.perfil_sistema || user?.role;
  const isCompanyAdmin = perfilAcesso === 'admin_empresa';
  const isCompleteSuperAdmin = isSuperAdmin || permData?.isSuperAdmin;

  const contextValue = {
    user,
    roleId: user?.role,
    perfilAcesso,
    cargo: user?.cargo,
    // USAR APENAS V2 (novo padrão)
    effectivePermissionsV2: permData?.effectivePermissionsV2 || {},
    rbacReady,
    isSuperAdmin: isCompleteSuperAdmin,
    isCompanyAdmin,
    isLoading: userLoading || permLoading,
    error: null,
    refetch: async () => {
      await refetchUser();
      await refetchPerms();
    }
  };

  return (
    <RBACContext.Provider value={contextValue}>
      {children}
    </RBACContext.Provider>
  );
  }

export function useRBAC() {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error('useRBAC must be used within RBACProvider');
  }
  return context;
}

export function useHasPermission(permissionKey) {
  const { effectivePermissionsV2, isSuperAdmin, isCompanyAdmin, rbacReady } = useRBAC();

  if (isSuperAdmin) return true;
  // ANTI-FLICKER: retorna null (indeterminado) até rbacReady
  if (!rbacReady) return null;

  // Admin empresa: acesso total exceto ADMIN_CONFIG
  const normalizedKey = String(permissionKey || '').trim();
  if (isCompanyAdmin && normalizedKey !== 'ADMIN_CONFIG') return true;

  return effectivePermissionsV2[normalizedKey] === true;
}

// FUNÇÃO ÚNICA DE AUTORIZAÇÃO (usando V2)
export function useCanAccess() {
  const { 
    isSuperAdmin, 
    isCompanyAdmin, 
    effectivePermissionsV2, 
    rbacReady,
    perfilAcesso
  } = useRBAC();

  return {
      /**
       * Verifica se user pode acessar uma permissão
       * @param {string} permissionKey - chave V2 (ex: "OBRAS_CREATE", "ADMIN_CONFIG")
       * @returns {boolean} true se permitido, false caso contrário
       */
      can(permissionKey) {
        // SUPERADMIN: acesso a TUDO
        if (isSuperAdmin) return true;

        // ANTI-FLICKER: retorna null (indeterminado) até rbacReady
        // Quem chama deve tratar null como "aguardando"
        if (!rbacReady) {
          return null;
        }

        // ADMIN_EMPRESA: acesso a tudo EXCETO ADMIN_CONFIG (só super)
        if (isCompanyAdmin && permissionKey !== 'ADMIN_CONFIG') {
          return true;
        }

        // Verificar permissão específica no V2
        if (!permissionKey) return true; // Sem requisito = público

        const normalizedKey = String(permissionKey).trim();
        const hasPermission = effectivePermissionsV2[normalizedKey] === true;

        if (!hasPermission) {
          console.log(`[RBAC DENY] ${perfilAcesso} não tem ${normalizedKey}`);
        }

        return hasPermission;
      },

      // Helpers
      isSuperAdmin,
      isCompanyAdmin,
      perfilAcesso
    };
  }