import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const acaoLabels = {
  create: 'Criada',
  update: 'Alterada',
  approve: 'Aprovada',
  rectify: 'Retificação',
  conclude: 'Concluída',
  delete: 'Deletada',
};

const acaoCores = {
  create: 'bg-blue-100 text-blue-800',
  update: 'bg-yellow-100 text-yellow-800',
  approve: 'bg-green-100 text-green-800',
  rectify: 'bg-purple-100 text-purple-800',
  conclude: 'bg-gray-100 text-gray-800',
  delete: 'bg-red-100 text-red-800',
};

export default function AuditLogBM({ entidade_id, entidade = 'BM' }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditlog', entidade_id],
    queryFn: async () => {
      const allLogs = await base44.asServiceRole.entities.AuditLog.filter({
        entidade_id,
        entidade,
      }, '-created_date');
      return allLogs;
    },
  });

  if (isLoading) {
    return <div className="flex justify-center p-4"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  if (!logs.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Histórico de Auditoria</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-slate-600 py-8 text-sm">
          Nenhuma ação registrada
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Histórico de Auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {logs.map((log, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={`${acaoCores[log.acao] || 'bg-slate-100'} text-xs`}>
                    {acaoLabels[log.acao] || log.acao}
                  </Badge>
                  <span className="text-xs text-slate-600">{log.usuario_id}</span>
                </div>
                <span className="text-xs text-slate-500">
                  {log.created_date && format(new Date(log.created_date), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
              {log.observacao && (
                <p className="text-xs text-slate-700 mb-1">{log.observacao}</p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}