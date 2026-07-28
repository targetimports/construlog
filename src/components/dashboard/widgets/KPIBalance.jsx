import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';

export default function KPIBalance({ config }) {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['unified-finance-kpis'],
    queryFn: () => base44.functions.invoke('getUnifiedFinanceKpis', {}),
  });

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const saldo = kpis?.data?.saldo_caixa || 0;

  return (
    <div className="p-6">
      <p className="text-gray-600 text-sm font-semibold uppercase">Saldo em Caixa</p>
      <p className={`text-3xl font-bold mt-2 ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        {saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>
      <p className="text-gray-500 text-xs mt-2">Saldo disponível</p>
    </div>
  );
}