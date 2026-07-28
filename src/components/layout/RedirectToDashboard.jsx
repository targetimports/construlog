import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { mapearPerfilPorCargo } from '../auth/mapearPerfilPorCargo';

/**
 * Redireciona para o dashboard apropriado baseado no perfil
 */
export default function RedirectToDashboard() {
  const navigate = useNavigate();
  
  const { data: user, isLoading } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  useEffect(() => {
    if (isLoading || !user) return;

    // Mapear perfil
    let perfil = user.perfil_sistema;
    if (!perfil && user.cargo) {
      perfil = mapearPerfilPorCargo(user.cargo);
    }
    if (!perfil) perfil = 'campo';

    // Redirecionar para dashboard específico
    const dashboardMap = {
      admin: 'Dashboard',
      financeiro: 'Dashboard',
      diretoria: 'Dashboard',
      engenharia: 'DashboardEngenharia',
      compras: 'DashboardCompras',
      almoxarifado: 'DashboardAlmoxarifado',
      logistica: 'DashboardLogistica',
      campo: 'DashboardCampo'
    };

    const dashboardPage = dashboardMap[perfil] || 'DashboardCampo';
    console.log(`[REDIRECT] Perfil ${perfil} → ${dashboardPage}`);
    
    navigate(createPageUrl(dashboardPage), { replace: true });
  }, [user, isLoading, navigate]);

  return null;
}