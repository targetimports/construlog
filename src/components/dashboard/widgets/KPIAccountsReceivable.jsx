import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';

export default function KPIAccountsReceivable({ config }) {
  const { data: contas, isLoading } = useQuery({
    queryKey: ['contas-receber-kpi'],
    queryFn: () => base44.entities.ContaFinanceira.filter({ 
      tipo: 'receber',
      status: ['pendente', 'atrasado']
    }),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const total = (contas || []).reduce((sum, c) => sum + (c.valor || 0), 0);

  return (
    <div className="p-6">
      <p className="text-gray-600 text-sm font-semibold uppercase">Contas a Receber</p>
      <p className="text-3xl font-bold text-green-600 mt-2">
        {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
      <p className="text-gray-500 text-xs mt-2">{contas?.length || 0} contas</p>
    </div>
  );
}