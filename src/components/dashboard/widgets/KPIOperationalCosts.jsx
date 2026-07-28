import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';

export default function KPIOperationalCosts({ config }) {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['unified-finance-kpis-costs'],
    queryFn: () => base44.functions.invoke('getUnifiedFinanceKpis', {}),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const custos = kpis?.data?.custos_operacionais || 0;

  return (
    <div className="p-6">
      <p className="text-gray-600 text-sm font-semibold uppercase">Custos do Período</p>
      <p className="text-3xl font-bold text-amber-600 mt-2">
        {custos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
      <p className="text-gray-500 text-xs mt-2">Últimos 30 dias</p>
    </div>
  );
}