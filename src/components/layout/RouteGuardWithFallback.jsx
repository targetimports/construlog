import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { isCompanyAdmin, isTiRoute } from '../auth/rbacHelpers';
import { useRBAC } from '../shared/RBACContext';

/**
 * Guard de rotas com failsafe
 * Previne tela branca quando usuário não tem permissão
 */
export default function RouteGuardWithFallback({ children, currentPageName }) {
  const navigate = useNavigate();
  const [verificado, setVerificado] = useState(false);
  const { bypassMode, bypassReason, isSuperAdmin, isCompanyAdmin: isCompanyAdminRbac } = useRBAC();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: permissoesUsuario } = useQuery({
    queryKey: ['permissoes-usuario', user?.email],
    queryFn: () => base44.entities.PermissaoUsuario.filter({ user_email: user.email }),
    enabled: !!user?.email
  });

  useEffect(() => {
    let mounted = true;

    if (userLoading || !user) return;

    // Não verificar páginas de sistema
    const paginasSistema = ['SemPermissao', 'Dashboard', 'Ajuda', 'Ajustes'];
    if (paginasSistema.includes(currentPageName)) {
      if (mounted) setVerificado(true);
      return;
    }

    const perfilAcesso = user.perfil_acesso || user.perfil_sistema || user.role;

    // SUPER ADMIN (PROGRAMADOR): ACESSO TOTAL
        const isSuperAdminProfile = perfilAcesso === 'programador';
        const isSuperAdminFlag = isSuperAdmin || isSuperAdminProfile || user?.isOwner === true;

        if (isSuperAdminFlag) {
          console.log(`[ROUTE GUARD] Super admin ${perfilAcesso}: acesso total a ${currentPageName}`);
          if (mounted) setVerificado(true);
          return;
        }

        // ADMIN EMPRESA: ACESSO TUDO EXCETO TI
        const isAdminEmpresa = perfilAcesso === 'admin' || perfilAcesso === 'admin_empresa' || user?.cargo === 'admin_empresa' || isCompanyAdminRbac;

        if (isAdminEmpresa) {
          const isTi = isTiRoute(currentPageName);
          if (isTi) {
            console.log(`[ROUTE GUARD] Admin empresa ${perfilAcesso}: TI bloqueado (${currentPageName})`);
            if (mounted) navigate(createPageUrl('SemPermissao'), { replace: true });
            return;
          }
          console.log(`[ROUTE GUARD] Admin empresa ${perfilAcesso}: acesso permitido a ${currentPageName}`);
          if (mounted) setVerificado(true);
          return;
        }

        // OUTROS PERFIS: permitir navegação (as permissões serão validadas em componentes)
        console.log(`[ROUTE GUARD] Perfil ${perfilAcesso}: navegação para ${currentPageName}`);
        if (mounted) setVerificado(true);

    return () => {
      mounted = false;
    };
  }, [user, userLoading, currentPageName, bypassMode, isSuperAdmin, isCompanyAdminRbac, navigate]);

  // ANTI-FLICKER: retornar null silencioso enquanto verifica
  if (userLoading || !verificado) {
    return null;
  }

  return children;
}