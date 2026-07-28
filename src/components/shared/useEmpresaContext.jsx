import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createContext, useContext } from 'react';

export const EmpresaContext = createContext(null);

/**
 * Hook para acessar contexto da empresa atual do usuário
 */
export function useEmpresaContext() {
  const context = useContext(EmpresaContext);
  if (!context) {
    throw new Error('useEmpresaContext deve ser usado dentro de EmpresaProvider');
  }
  return context;
}

/**
 * Hook para carregar dados da empresa do usuário
 */
export function useEmpresa() {
  const userQuery = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });
  const user = userQuery.data;

  // GLOBAL = admin, staff da matriz (acesso_global) ou usuário sem empresa vinculada.
  const acessoGlobal = !!(user && (user.role === 'admin' || user.acesso_global === true || !user.empresa_id));

  // Lista de empresas visíveis (o backend já escopa: matriz vê todas; membro vê a sua).
  const empresasQuery = useQuery({
    queryKey: ['empresas-contexto'],
    queryFn: () => base44.entities.Empresa.list(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const empresas = empresasQuery.data || [];
  const matriz = empresas.find((e) => e.tipo === 'matriz') || null;
  const membros = empresas.filter((e) => e.tipo === 'membro');
  const empresa = user?.empresa_id ? (empresas.find((e) => e.id === user.empresa_id) || null) : null;

  return {
    user,
    empresa,                 // empresa-membro do usuário (null p/ matriz/global)
    empresaId: user?.empresa_id || null,
    acessoGlobal,
    isMatriz: acessoGlobal,
    matriz,
    membros,
    empresas,
    perfil: null,            // legado — o RBAC real é do backend (rbac.js)
    isLoading: userQuery.isLoading || empresasQuery.isLoading,
  };
}

/**
 * Hook para verificar se usuário tem permissão para uma ação
 */
export function usePermissoes() {
  const { perfil } = useEmpresa();

  const temPermissao = (recurso, acao) => {
    if (!perfil) return false;
    
    const permissaoRecurso = perfil.permissoes?.find(p => p.recurso === recurso);
    return permissaoRecurso?.acoes?.includes(acao) || perfil.nivel_acesso === 'super_admin';
  };

  const temAcesso = (recurso) => {
    if (!perfil) return false;
    return perfil.permissoes?.some(p => p.recurso === recurso) || perfil.nivel_acesso === 'super_admin';
  };

  return { temPermissao, temAcesso, perfil };
}