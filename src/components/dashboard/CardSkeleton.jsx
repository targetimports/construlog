/**
 * CardSkeleton - Loading skeleton local para cards
 * Evita tela inteira em branco enquanto carrega
 */

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export function CardSkeleton({ showSubtitle = true, showTrend = true }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      {/* Ícone + Título */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>

      {/* Subtitle */}
      {showSubtitle && (
        <Skeleton className="h-4 w-40 mb-4" />
      )}

      {/* Trend */}
      {showTrend && (
        <Skeleton className="h-4 w-48" />
      )}
    </div>
  );
}

export default CardSkeleton;