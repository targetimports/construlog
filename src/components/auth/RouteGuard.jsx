import React, { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { podeAcessarRota } from './menusPorCargo';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function RouteGuard({ children, pageName }) {
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: permissoesUsuario } = useQuery({
    queryKey: ['permissoes-usuario', user?.email],
    queryFn: () => base44.entities.PermissaoUsuario.filter({ user_email: user.email }),
    enabled: !!user?.email
  });

  useEffect(() => {
    if (user && permissoesUsuario !== undefined) {
      const temPermissao = podeAcessarRota(pageName, user, permissoesUsuario);
      
      if (!temPermissao) {
        // Registrar tentativa de acesso não autorizado
        base44.entities.LogAuditoria.create({
          user_email: user.email,
          acao: 'acesso_negado',
          modulo: 'roteamento',
          entidade: 'pagina',
          entidade_id: pageName,
          detalhes: `Tentativa de acesso à página ${pageName} sem permissão`,
          sucesso: false
        }).catch(err => console.error('Erro ao registrar log:', err));

        // Redirecionar para página sem permissão
        navigate(createPageUrl('SemPermissao'));
      }
    }
  }, [user, permissoesUsuario, pageName, navigate]);

  // Enquanto carrega, não mostrar conteúdo
  if (!user || permissoesUsuario === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  const temPermissao = podeAcessarRota(pageName, user, permissoesUsuario);

  if (!temPermissao) {
    return null; // Não renderizar nada enquanto redireciona
  }

  return <>{children}</>;
}