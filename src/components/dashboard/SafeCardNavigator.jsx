/**
 * SafeCardNavigator - Componente wrapper seguro para cards com navegação
 * - Validação de permissão antes de navegar (NUNCA throw 403)
 * - Tratamento de erros sem crash
 * - Bloqueia cliques múltiplos (sem travamento)
 * - Mostra estado visual de indisponível se sem permissão
 */

import React, { useState, useCallback, useRef } from 'react';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCanAccess } from '../shared/RBACContext';
import { useNavigate } from 'react-router-dom';
import { isValidRoute } from '../shared/resolveRouteByKey';

export function SafeCardNavigator({
  children,
  routePath,
  requiredPermission,
  className = '',
  onNavigate,
  disabled = false,
  tooltipText = null
}) {
  const navigate = useNavigate();
  const rbacContext = useCanAccess();
  const can = rbacContext?.can;
  const [isNavigating, setIsNavigating] = useState(false);
  const clickTimeoutRef = useRef(null);

  // Validar se tem permissão - NUNCA lança erro
  const hasPermission = requiredPermission 
    ? (can && typeof can === 'function' ? can(requiredPermission, routePath) : true)
    : true;

  // Validar se rota é válida (existe no sistema)
  const isValidPath = routePath ? isValidRoute(routePath) : false;

  const isDisabled = disabled || !hasPermission || !routePath || !isValidPath;

  const handleClick = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Bloquear cliques múltiplos (sem travamento de UI)
    if (isNavigating) {
      console.warn('[SafeCardNavigator] Click blocked: already navigating');
      return;
    }

    // Sem permissão = toast + return (NUNCA throw)
    if (!hasPermission) {
      toast.error('Você não tem permissão para acessar este recurso');
      return;
    }

    // Sem rota ou rota inválida = toast + return
    if (!routePath || !isValidPath) {
      console.warn('[SafeCardNavigator] Invalid route:', routePath);
      toast.error('Funcionalidade indisponível no momento');
      return;
    }

    setIsNavigating(true);

    try {
      // Callback pre-navegação (com error handling)
      if (onNavigate) {
        try {
          await onNavigate();
        } catch (err) {
          console.error('[SafeCardNavigator] onNavigate error:', err);
          toast.error('Falha ao preparar navegação');
          setIsNavigating(false);
          return;
        }
      }

      // Navegar (NUNCA throw aqui)
      try {
        navigate(routePath);
      } catch (err) {
        console.error('[SafeCardNavigator] navigate() error:', err);
        toast.error('Falha ao abrir página');
      }
    } finally {
      // SEMPRE desbloquear clique (even if error)
      clickTimeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 200);
    }
  }, [navigate, routePath, hasPermission, isNavigating, onNavigate, isValidPath]);

  // Cleanup timeout
  React.useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  // Sem permissão = bloqueado (NUNCA navegável)
  if (!hasPermission && requiredPermission) {
    return (
      <div
        className={`relative ${className}`}
        title={tooltipText || 'Você não tem permissão para acessar este recurso'}
      >
        <div className="absolute inset-0 bg-gray-900/10 rounded-lg z-10 flex items-center justify-center pointer-events-none">
          <Lock className="h-6 w-6 text-gray-500" />
        </div>
        <div className="opacity-60 pointer-events-none">
          {children}
        </div>
      </div>
    );
  }

  // Sem rota ou rota inválida = indisponível (NUNCA navegável)
  if (!routePath || !isValidPath) {
    return (
      <div
        className={`relative ${className}`}
        title={tooltipText || 'Funcionalidade indisponível'}
      >
        <div className="absolute inset-0 bg-amber-900/5 rounded-lg z-10 flex items-center justify-center pointer-events-none">
          <AlertCircle className="h-6 w-6 text-amber-500" />
        </div>
        <div className="opacity-60 pointer-events-none">
          {children}
        </div>
      </div>
    );
  }

  // Card normal (clicável) - com proteção contra travamento
  return (
    <button
      onClick={handleClick}
      disabled={isNavigating}
      className={`${className} relative disabled:opacity-60 transition-all ${isNavigating ? 'cursor-wait' : 'cursor-pointer'}`}
      type="button"
      title={isNavigating ? 'Carregando...' : undefined}
    >
      {/* Overlay de loading (SEM pointer-events-none para não travar) */}
      {isNavigating && (
        <div className="absolute inset-0 bg-white/30 rounded-lg flex items-center justify-center z-20 pointer-events-auto">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
        </div>
      )}
      {children}
    </button>
  );
}

export default SafeCardNavigator;