import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Mapeamento de permissões por perfil
const PERMISSIONS = {
  administrador: {
    obras: { ver: true, criar: true, editar: true, excluir: true },
    financeiro: { ver: true, criar: true, editar: true, excluir: true },
    frota: { ver: true, criar: true, editar: true, excluir: true },
    estoque: { ver: true, criar: true, editar: true, excluir: true },
    compras: { ver: true, criar: true, editar: true, excluir: true },
    colaboradores: { ver: true, criar: true, editar: true, excluir: true },
    relatorios: { ver: true, criar: false, editar: false, excluir: false },
    configuracoes: { ver: true, criar: true, editar: true, excluir: true },
    usuarios: { ver: true, criar: true, editar: true, excluir: true }
  },
  diretor: {
    obras: { ver: true, criar: true, editar: true, excluir: true },
    financeiro: { ver: true, criar: true, editar: true, excluir: false },
    frota: { ver: true, criar: true, editar: true, excluir: false },
    estoque: { ver: true, criar: true, editar: true, excluir: false },
    compras: { ver: true, criar: true, editar: true, excluir: false },
    colaboradores: { ver: true, criar: true, editar: true, excluir: false },
    relatorios: { ver: true, criar: false, editar: false, excluir: false },
    configuracoes: { ver: true, criar: false, editar: true, excluir: false },
    usuarios: { ver: true, criar: true, editar: true, excluir: false }
  },
  engenharia: {
    obras: { ver: true, criar: true, editar: true, excluir: false },
    financeiro: { ver: true, criar: false, editar: false, excluir: false },
    frota: { ver: true, criar: false, editar: false, excluir: false },
    estoque: { ver: true, criar: true, editar: true, excluir: false },
    compras: { ver: true, criar: true, editar: false, excluir: false },
    colaboradores: { ver: true, criar: false, editar: false, excluir: false },
    relatorios: { ver: true, criar: false, editar: false, excluir: false },
    configuracoes: { ver: false, criar: false, editar: false, excluir: false },
    usuarios: { ver: false, criar: false, editar: false, excluir: false }
  },
  financeiro: {
    obras: { ver: true, criar: false, editar: false, excluir: false },
    financeiro: { ver: true, criar: true, editar: true, excluir: true },
    frota: { ver: true, criar: false, editar: false, excluir: false },
    estoque: { ver: true, criar: false, editar: false, excluir: false },
    compras: { ver: true, criar: true, editar: true, excluir: false },
    colaboradores: { ver: true, criar: false, editar: false, excluir: false },
    relatorios: { ver: true, criar: false, editar: false, excluir: false },
    configuracoes: { ver: false, criar: false, editar: false, excluir: false },
    usuarios: { ver: false, criar: false, editar: false, excluir: false }
  },
  logistica: {
    obras: { ver: true, criar: false, editar: false, excluir: false },
    financeiro: { ver: false, criar: false, editar: false, excluir: false },
    frota: { ver: true, criar: true, editar: true, excluir: true },
    estoque: { ver: true, criar: true, editar: true, excluir: false },
    compras: { ver: true, criar: true, editar: false, excluir: false },
    colaboradores: { ver: true, criar: false, editar: false, excluir: false },
    relatorios: { ver: true, criar: false, editar: false, excluir: false },
    configuracoes: { ver: false, criar: false, editar: false, excluir: false },
    usuarios: { ver: false, criar: false, editar: false, excluir: false }
  },
  compras: {
    obras: { ver: true, criar: false, editar: false, excluir: false },
    financeiro: { ver: true, criar: false, editar: false, excluir: false },
    frota: { ver: true, criar: false, editar: false, excluir: false },
    estoque: { ver: true, criar: true, editar: true, excluir: false },
    compras: { ver: true, criar: true, editar: true, excluir: false },
    colaboradores: { ver: false, criar: false, editar: false, excluir: false },
    relatorios: { ver: true, criar: false, editar: false, excluir: false },
    configuracoes: { ver: false, criar: false, editar: false, excluir: false },
    usuarios: { ver: false, criar: false, editar: false, excluir: false }
  },
  almoxarifado: {
    obras: { ver: true, criar: false, editar: false, excluir: false },
    financeiro: { ver: false, criar: false, editar: false, excluir: false },
    frota: { ver: false, criar: false, editar: false, excluir: false },
    estoque: { ver: true, criar: true, editar: true, excluir: false },
    compras: { ver: true, criar: false, editar: false, excluir: false },
    colaboradores: { ver: false, criar: false, editar: false, excluir: false },
    relatorios: { ver: true, criar: false, editar: false, excluir: false },
    configuracoes: { ver: false, criar: false, editar: false, excluir: false },
    usuarios: { ver: false, criar: false, editar: false, excluir: false }
  },
  rh: {
    obras: { ver: true, criar: false, editar: false, excluir: false },
    financeiro: { ver: false, criar: false, editar: false, excluir: false },
    frota: { ver: false, criar: false, editar: false, excluir: false },
    estoque: { ver: false, criar: false, editar: false, excluir: false },
    compras: { ver: false, criar: false, editar: false, excluir: false },
    colaboradores: { ver: true, criar: true, editar: true, excluir: true },
    relatorios: { ver: true, criar: false, editar: false, excluir: false },
    configuracoes: { ver: false, criar: false, editar: false, excluir: false },
    usuarios: { ver: true, criar: true, editar: true, excluir: false }
  },
  visualizacao: {
    obras: { ver: true, criar: false, editar: false, excluir: false },
    financeiro: { ver: true, criar: false, editar: false, excluir: false },
    frota: { ver: true, criar: false, editar: false, excluir: false },
    estoque: { ver: true, criar: false, editar: false, excluir: false },
    compras: { ver: true, criar: false, editar: false, excluir: false },
    colaboradores: { ver: true, criar: false, editar: false, excluir: false },
    relatorios: { ver: true, criar: false, editar: false, excluir: false },
    configuracoes: { ver: false, criar: false, editar: false, excluir: false },
    usuarios: { ver: false, criar: false, editar: false, excluir: false }
  }
};

export const usePermissions = () => {
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        return await base44.auth.me();
      } catch {
        return null;
      }
    }
  });

  const checkPermission = (modulo, acao = 'ver') => {
    if (!user) return false;
    if (user.role === 'admin') return true; // Admin padrão do Base44 tem acesso total
    
    const perfil = user.perfil || 'visualizacao';
    const permissions = PERMISSIONS[perfil];
    
    if (!permissions || !permissions[modulo]) return false;
    return permissions[modulo][acao] || false;
  };

  return {
    user,
    checkPermission,
    isAdmin: user?.role === 'admin',
    perfil: user?.perfil || 'visualizacao'
  };
};

export default function PermissionGate({ modulo, acao = 'ver', children, fallback = null }) {
  const { checkPermission } = usePermissions();

  if (!checkPermission(modulo, acao)) {
    return fallback;
  }

  return children;
}