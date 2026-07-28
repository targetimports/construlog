import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import rolePermissions from '@/components/auth/rolePermissions.json';

/**
 * Smart Dashboard - renderiza Dashboard Executivo ou Operacional baseado no perfil
 * Executa redirect em tempo real se necessário
 */
export default function SmartDashboard() {
  const [dashboardType, setDashboardType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity
  });

  useEffect(() => {
    if (user?.perfil_acesso) {
      const profile = rolePermissions.roles[user.perfil_acesso];
      if (profile && profile.dashboardType) {
        setDashboardType(profile.dashboardType);
        setIsLoading(false);
      }
    }
  }, [user?.perfil_acesso]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando Dashboard...</p>
        </div>
      </div>
    );
  }

  // Executivo: renderiza ExecutivoDashboard
  if (dashboardType === 'executivo') {
    // Importar dinamicamente para evitar ciclo de importação
    const ExecutivoDashboard = React.lazy(() => 
      import('./ExecutivoDashboard').catch(() => ({ default: () => null }))
    );
    
    return (
      <React.Suspense fallback={<div className="p-4">Carregando...</div>}>
        <ExecutivoDashboard />
      </React.Suspense>
    );
  }

  // Operacional: renderiza Dashboard padrão
  // Importar dinamicamente
  const OperationalDashboard = React.lazy(() => 
    import('../pages/Dashboard').catch(() => ({ default: () => null }))
  );

  return (
    <React.Suspense fallback={<div className="p-4">Carregando...</div>}>
      <OperationalDashboard />
    </React.Suspense>
  );
}