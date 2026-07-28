import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';

export default function OverdueAccountsList({ config }) {
  const { data: contas, isLoading } = useQuery({
    queryKey: ['contas-vencidas-lista'],
    queryFn: () => base44.entities.ContaFinanceira.filter({ 
      status: 'atrasado'
    }, '-data_vencimento', 5),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const total = (contas || []).reduce((sum, c) => sum + (c.valor || 0), 0);

  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Contas Vencidas</h3>
      <p className="text-lg font-bold text-red-600 mb-3">
        {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
      <p className="text-xs text-gray-600">{contas?.length || 0} contas atrasadas</p>
    </div>
  );
}