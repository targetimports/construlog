import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import OpsApprovalsTable from '@/components/ops/OpsApprovalsTable';
import { TableSkeleton } from '@/components/shared/Skeletons';

export default function OpsAprovacoes() {
  const [statusFilter, setStatusFilter] = useState('pendente');

  const { data: approvals, refetch, isLoading } = useQuery({
    queryKey: ['ops-approvals', statusFilter],
    queryFn: async () => {
      const res = await base44.functions.invoke('listarOpsAprovacoes', {
        status: statusFilter,
        limit: 50
      });
      return res.data?.aprovacoes || [];
    },
    refetchInterval: 10000
  });

  const statusCounts = useQuery({
    queryKey: ['ops-approvals-counts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('listarOpsAprovacoes', {
        limit: 100
      });
      const all = res.data?.aprovacoes || [];
      return {
        pendente: all.filter(a => a.status === 'pendente').length,
        aprovada: all.filter(a => a.status === 'aprovada').length,
        rejeitada: all.filter(a => a.status === 'rejeitada').length,
        executada: all.filter(a => a.status === 'executada').length
      };
    },
    refetchInterval: 15000
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Aprovações Operacionais</h1>
        <p className="text-gray-600">
          Gerenciar solicitações de aprovação para operações críticas em produção (restore, rollback, mudança de modo).
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {['pendente', 'aprovada', 'rejeitada', 'executada'].map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'outline'}
                onClick={() => setStatusFilter(status)}
                className="gap-2"
              >
                {status === 'pendente' && ''}
                {status === 'aprovada' && ''}
                {status === 'rejeitada' && ''}
                {status === 'executada' && ''}
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {statusCounts.data && <span className="text-xs bg-gray-200 px-2 py-1 rounded">
                  {status === 'pendente' && statusCounts.data.pendente}
                  {status === 'aprovada' && statusCounts.data.aprovada}
                  {status === 'rejeitada' && statusCounts.data.rejeitada}
                  {status === 'executada' && statusCounts.data.executada}
                </span>}
              </Button>
            ))}
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="gap-2 ml-auto"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Aprovações */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
        </h2>
        {isLoading ? (
          <Card>
            <CardContent className="p-0">
              <TableSkeleton bare rows={6} cols={5} />
            </CardContent>
          </Card>
        ) : (
          <OpsApprovalsTable 
            approvals={approvals}
            onRefresh={() => refetch()}
          />
        )}
      </div>
    </div>
  );
}