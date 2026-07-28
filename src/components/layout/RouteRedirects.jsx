import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { routeRedirects } from './navigation';
import { createPageUrl } from '@/utils';

/**
 * Componente de Redirecionamento Automático
 * 
 * Detecta rotas antigas e redireciona para as novas
 * sem quebrar bookmarks ou links salvos
 */
export default function RouteRedirects() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Extrair nome da página atual da URL
    const currentPath = location.pathname.split('/').pop();
    
    // Verificar se existe redirect configurado
    if (routeRedirects[currentPath]) {
      const newPage = routeRedirects[currentPath];
      console.log(`[RouteRedirect] ${currentPath} → ${newPage}`);
      
      // Redirecionar mantendo query params se existirem
      const newUrl = createPageUrl(newPage) + location.search;
      navigate(newUrl, { replace: true });
    }

    // Redirects para rotas antigas de obra específica
    // Ex: /obras/resumo → /obras/:lastObraId/resumo
    const obraSpecificRoutes = [
      'resumo', 'notas-fiscais', 'mao-de-obra', 'material', 
      'alimentacao', 'aluguel-combustivel', 'fretes', 'estadias', 
      'impostos', 'retiradas', 'pessoas', 'bi-compras'
    ];

    if (location.pathname.startsWith('/obras/') && obraSpecificRoutes.includes(currentPath)) {
      const lastObraId = localStorage.getItem('lastObraId');
      if (lastObraId) {
        console.log(`[RouteRedirect] /obras/${currentPath} → /obras/${lastObraId}/${currentPath}`);
        navigate(`/obras/${lastObraId}/${currentPath}`, { replace: true });
      } else {
        console.log(`[RouteRedirect] /obras/${currentPath} → /obras (sem lastObraId)`);
        navigate('/obras', { replace: true });
      }
    }
  }, [location, navigate]);

  return null; // componente invisível
}