import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';

export default function PendingRequisitionsList({ config }) {
  const { data: requisicoes, isLoading } = useQuery({
    queryKey: ['requisicoes-pendentes-lista'],
    queryFn: () => base44.entities.RequisicaoCompra.filter({ 
      status: 'solicitada'
    }, '-created_date', 6),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Requisições Pendentes</h3>
      <div className="space-y-2">
        {(requisicoes || []).slice(0, 4).map(req => (
          <div key={req.id} className="flex justify-between items-start p-2 bg-amber-50 rounded border-l-2 border-amber-500">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900">{req.descricao?.substring(0, 30)}...</p>
              <p className="text-xs text-gray-600">Qtd: {req.quantidade}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}