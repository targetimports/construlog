import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ListSkeleton } from '@/components/shared/Skeletons';

export default function Rollbacks() {
  const [expandedJob, setExpandedJob] = useState(null);
  const [filterStatus, setFilterStatus] = useState(null);

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['rollback-jobs', filterStatus],
    queryFn: async () => {
      const res = await base44.functions.invoke('listarRollbackJobs', {
        status: filterStatus,
        limit: 50
      });
      return res.data?.jobs || [];
    },
    refetchInterval: 30000
  });

  const jobs = jobsData || [];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-4xl font-bold">↩Rollback Jobs</h1>
        <p className="text-gray-600 mt-2">Histórico de snapshots e restaurações</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button
          variant={filterStatus === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus(null)}
        >
          Todos ({jobs.length})
        </Button>
        <Button
          variant={filterStatus === 'sucesso' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('sucesso')}
        >
          ✓ Sucesso ({jobs.filter(j => j.status === 'sucesso').length})
        </Button>
        <Button
          variant={filterStatus === 'falha' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('falha')}
        >
          ✗ Falha ({jobs.filter(j => j.status === 'falha').length})
        </Button>
        <Button
          variant={filterStatus === 'executando' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('executando')}
        >
          Executando ({jobs.filter(j => j.status === 'executando').length})
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : jobs.length === 0 ? (
        <div className="text-center py-8 text-gray-500">Nenhum job encontrado</div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3 flex-1">
                  {expandedJob === job.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          job.status === 'sucesso'
                            ? 'bg-green-100 text-green-800'
                            : job.status === 'falha'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                        }
                      >
                        {job.status}
                      </Badge>
                      <span className="font-semibold">{job.acao || 'Snapshot'}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(job.initiated_at).toLocaleString('pt-BR')} • {job.initiated_by}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono text-gray-600">
                    {job.snapshot_id?.substring(0, 12)}...
                  </div>
                </div>
              </CardHeader>

              {expandedJob === job.id && (
                <CardContent className="border-t pt-4 space-y-3">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 font-semibold mb-1">Snapshot ID:</p>
                      <p className="font-mono text-xs break-all">{job.snapshot_id}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 font-semibold mb-1">Motivo:</p>
                      <p>{job.motivo || '-'}</p>
                    </div>
                  </div>

                  {job.restore_plan && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm font-semibold mb-2">Plano de Restauração:</p>
                      <div className="text-xs space-y-1">
                        <div>Total: {job.restore_plan.total_records} registros</div>
                        <div>Upserts: {job.restore_plan.upserts}</div>
                        <div>Ignorados: {job.restore_plan.skipped_records}</div>
                        {job.restore_plan.entities_to_restore && (
                          <div className="mt-2">
                            Entidades: {job.restore_plan.entities_to_restore.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {job.restore_result && (
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm font-semibold mb-2">Resultado:</p>
                      <div className="text-xs space-y-1">
                        <div>✓ Sucesso: {job.restore_result.success_count}</div>
                        <div>✗ Erros: {job.restore_result.error_count}</div>
                        <div>Ignorados: {job.restore_result.skipped_count}</div>
                      </div>
                    </div>
                  )}

                  {job.error && (
                    <div className="bg-red-50 p-3 rounded border border-red-200">
                      <p className="text-xs text-red-700 font-semibold mb-1">Erro:</p>
                      <p className="text-xs text-red-600">{job.error}</p>
                    </div>
                  )}

                  {job.finished_at && (
                    <div className="text-xs text-gray-500">
                      Finalizado: {new Date(job.finished_at).toLocaleString('pt-BR')}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}