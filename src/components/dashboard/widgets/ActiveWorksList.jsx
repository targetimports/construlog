import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function ActiveWorksList({ config }) {
  const { data: obras, isLoading } = useQuery({
    queryKey: ['obras-ativas-lista'],
    queryFn: () => base44.entities.Obra.filter({ status: 'em_andamento' }, '-updated_date', 5),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Minhas Obras Ativas</h3>
      <div className="space-y-2">
        {(obras || []).slice(0, 4).map(obra => (
          <div key={obra.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{obra.nome}</p>
              <p className="text-xs text-gray-600">{obra.cliente}</p>
            </div>
            <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-800 rounded flex-shrink-0">
              {obra.status?.replace(/_/g, ' ')}
            </span>
          </div>
        ))}
        {obras?.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4">Nenhuma obra ativa</p>
        )}
      </div>
    </div>
  );
}