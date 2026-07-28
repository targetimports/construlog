import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Lock } from 'lucide-react';

/**
 * Guard para validar permissões antes de permitir ações
 * Uso: <PermissaoGuard acao="criar" modulo="compras" obraId={obraId}>
 *        <button>Criar Requisição</button>
 *      </PermissaoGuard>
 */
export default function PermissaoGuard({ 
  acao, 
  modulo, 
  obraId, 
  children,
  fallback = null,
  mensagemFallback = null
}) {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: 300000
  });

  const perfil = user?.perfil_acesso || user?.perfil_sistema || user?.role || '';
  const isAdminFull = perfil === 'admin' || perfil === 'programador' || perfil === 'admin_empresa' || user?.cargo === 'admin_empresa' || user?.role === 'admin' || user?.role === 'programador';

  const { data: permissao, isLoading } = useQuery({
    queryKey: ['validar-permissao', acao, modulo, obraId],
    queryFn: async () => {
      if (isAdminFull) return { permitido: true };
      const res = await base44.functions.invoke('validarPermissaoAcao', {
        acao,
        modulo,
        obra_id: obraId
      });
      return res.data;
    },
    enabled: !!user && !isAdminFull
  });

  // Enquanto o user não carregou, mostrar loading em vez de negar
  if (!user) {
    return <div className="text-gray-400 text-sm">Validando...</div>;
  }

  if (isAdminFull) {
    return children;
  }

  if (isLoading) {
    return <div className="text-gray-400 text-sm">Validando...</div>;
  }

  if (!permissao?.permitido) {
    return fallback || (
      <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-lg">
        <Lock className="w-4 h-4" />
        <span>{mensagemFallback || permissao?.motivo || 'Sem permissão para esta ação'}</span>
      </div>
    );
  }

  return children;
}