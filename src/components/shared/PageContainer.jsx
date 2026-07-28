/**
 * Padrão de container para páginas com estados: loading / empty / error / success
 * 
 * Uso:
 * <PageContainer
 *   isLoading={isLoading}
 *   error={error}
 *   isEmpty={data?.length === 0}
 *   onRetry={refetch}
 * >
 *   <YourContent />
 * </PageContainer>
 */

import React from 'react';
import { Loader2, AlertCircle, InboxIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from './useApiError';

export function PageContainer({
  isLoading = false,
  error = null,
  isEmpty = false,
  children,
  onRetry,
  loadingMessage = 'Carregando...',
  emptyMessage = 'Nenhum resultado encontrado',
  emptyIcon: EmptyIcon = InboxIcon
}) {
  // Loading skeleton
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <ErrorBanner 
          error={error}
          onRetry={onRetry}
          onDismiss={() => {}} // callback se necessário
        />
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <EmptyIcon className="h-12 w-12 text-gray-400 mb-3" />
        <p className="text-gray-600 font-medium">{emptyMessage}</p>
      </div>
    );
  }

  // Success - render children
  return <>{children}</>;
}

/**
 * Skeleton loader customizável
 */
export function SkeletonLoader({ 
  count = 3, 
  height = 'h-12', 
  className = '' 
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`${height} bg-gray-200 rounded animate-pulse`}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton de tabela
 */
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`h-${i}`} className="h-8 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowI) => (
        <div key={`r-${rowI}`} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, colI) => (
            <div key={`c-${colI}`} className="h-10 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}