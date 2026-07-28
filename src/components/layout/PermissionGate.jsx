import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';
import { hasPermission } from './navigation';

/**
 * Gate de Permissão
 * 
 * Bloqueia acesso a conteúdo se usuário não tiver role permitido
 */
export default function PermissionGate({ rolesAllowed = [], children, fallback = null }) {
  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  if (!user) {
    return (
      <Card className="border-l-4 border-yellow-500">
        <CardContent className="py-8">
          <div className="text-center">
            <ShieldAlert className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <p className="font-semibold text-gray-900">Carregando permissões...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const userRole = user.cargo || user.role || 'admin';

  // Admin tem acesso total
  if (userRole === 'admin') {
    return <>{children}</>;
  }

  // Verificar se role está permitido
  const hasAccess = rolesAllowed.length === 0 || rolesAllowed.includes(userRole);

  if (!hasAccess) {
    if (fallback) return fallback;
    
    return (
      <Card className="border-l-4 border-red-500">
        <CardContent className="py-12">
          <div className="text-center max-w-md mx-auto">
            <ShieldAlert className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Negado</h2>
            <p className="text-gray-600 mb-4">
              Você não possui permissão para acessar este módulo.
            </p>
            <p className="text-sm text-gray-500">
              Perfil atual: <strong className="text-gray-900">{userRole}</strong>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Perfis permitidos: <strong className="text-gray-900">{rolesAllowed.join(', ')}</strong>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}