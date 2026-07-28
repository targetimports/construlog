/**
 * SafeStatCard - Versão segura do StatCard com tratamento de erros
 * - Carregamento seguro sem crash (skeleton inline)
 * - Erro inline (NUNCA fullscreen ErrorBoundary)
 * - Botão de retry local (com onRetry callback)
 * - Bloqueado se sem permissão (ícone )
 * - Nunca causa travamento de clique
 */

import React, { useState } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import SafeCardNavigator from './SafeCardNavigator';
import CardSkeleton from './CardSkeleton';
import StatCard from './StatCard';
import { Button } from '@/components/ui/button';

/**
 * SafeStatCard - Wrapper seguro para StatCard
 * - Valida permissões antes de permitir clique
 * - Mostra skeleton enquanto carregando
 * - Mostra erro inline (NUNCA crash)
 * - Bloqueia card se sem permissão
 * - Nunca deixa UI travada
 */
export function SafeStatCard({
  title,
  routePath,
  requiredPermission,
  isLoading = false,
  error = null,
  data = null,
  onRetry = null,
  ...statCardProps
}) {
  const [retrying, setRetrying] = useState(false);

  // Retry local (NUNCA throw)
  const handleRetry = async () => {
    if (!onRetry) {
      console.warn('[SafeStatCard] No onRetry callback provided');
      return;
    }
    
    setRetrying(true);
    try {
      await onRetry();
    } catch (err) {
      console.error('[SafeStatCard] Retry failed:', err.message);
      // Mostra erro mas não dispara ErrorBoundary
    } finally {
      setRetrying(false);
    }
  };

  // Loading: skeleton inline (não trava clique)
  if (isLoading && !data) {
    return <CardSkeleton />;
  }

  // Erro: mostra inline, com retry (NUNCA dispara ErrorBoundary)
  if (error && !data) {
    return (
      <SafeCardNavigator
        routePath={null}
        disabled={true}
        className="bg-red-50 border border-red-200 rounded-lg p-6 shadow-sm"
      >
        <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
          <AlertCircle className="h-7 w-7 text-red-600" />
          <div>
            <p className="text-red-900 font-semibold text-sm">
              Erro ao carregar
            </p>
            <p className="text-red-700 text-xs mt-1 line-clamp-1">
              {error.message || 'Falha ao carregar indicador'}
            </p>
          </div>
          {onRetry && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleRetry();
              }}
              disabled={retrying}
              className="mt-1 text-red-600 hover:bg-red-100 hover:text-red-700"
            >
              <RotateCcw className={`h-3 w-3 mr-1 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Tentando...' : 'Retry'}
            </Button>
          )}
        </div>
      </SafeCardNavigator>
    );
  }

  // Sucesso: render normal (clicável com segurança)
  return (
    <SafeCardNavigator
      routePath={routePath}
      requiredPermission={requiredPermission}
      className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm hover:shadow-md transition-all text-left min-w-0"
    >
      <StatCard
        {...statCardProps}
        title={title}
        clickable
        isLoading={false}
        bare
      />
    </SafeCardNavigator>
  );
}

export default SafeStatCard;