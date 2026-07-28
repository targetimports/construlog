import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

/**
 * Guard de Permissão por Perfil
 * 
 * Uso:
 * <RequireRole allowedRoles={['diretor', 'financeiro']}>
 *   <ConteudoProtegido />
 * </RequireRole>
 */
export default function RequireRole({ allowedRoles = [], children, fallback = null }) {
  const navigate = useNavigate();
  
  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Usuário não autenticado
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-600" />
              Acesso Negado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Você precisa estar autenticado para acessar esta página.
            </p>
            <Button onClick={() => base44.auth.redirectToLogin()}>
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Obter role do usuário (fallback para 'leitura' se não definido)
  const userRole = user.cargo || user.role || 'leitura';

  // Verificar permissão
  const hasPermission = allowedRoles.length === 0 || 
                        allowedRoles.includes('*') || 
                        allowedRoles.includes(userRole) ||
                        userRole === 'diretor' || // Diretor sempre tem acesso
                        user.role === 'admin' ||  // Admin sempre tem acesso
                        user.role === 'programador'; // Programador sempre tem acesso

  // Se não tem permissão, mostrar fallback ou tela padrão
  if (!hasPermission) {
    if (fallback) return fallback;

    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Sem Permissão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Você não tem permissão para acessar esta página.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">
                <strong>Seu perfil:</strong> {userRole}
              </p>
              <p className="text-sm text-blue-700 mt-1">
                <strong>Perfis permitidos:</strong> {allowedRoles.join(', ')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/dashboard')} className="flex-1">
                Ir para Dashboard
              </Button>
              <Button onClick={() => navigate(-1)} variant="outline" className="flex-1">
                Voltar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tem permissão, renderizar children
  return <>{children}</>;
}