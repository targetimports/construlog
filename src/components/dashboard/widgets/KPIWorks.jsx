import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';

export default function KPIWorks({ config }) {
  const { data: obras, isLoading } = useQuery({
    queryKey: ['obras-ativas-kpi'],
    queryFn: () => base44.entities.Obra.filter({ status: 'em_andamento' }),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const count = obras?.length || 0;

  return (
    <div className="p-6">
      <p className="text-gray-600 text-sm font-semibold uppercase">Obras Ativas</p>
      <p className="text-3xl font-bold text-blue-600 mt-2">{count}</p>
      <p className="text-gray-500 text-xs mt-2">Em andamento</p>
    </div>
  );
}