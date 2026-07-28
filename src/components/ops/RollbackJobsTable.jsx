import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function RollbackJobsTable({ limit = 10 }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('listarRollbackJobs', { limit });
      if (res.data?.ok) {
        setJobs(res.data.jobs || []);
      }
    } catch (e) {
      console.error('Erro ao carregar jobs', e);
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          ↩Rollback Jobs Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">Ação</th>
                <th className="text-left py-2 px-2">Snapshot ID</th>
                <th className="text-left py-2 px-2">Iniciado por</th>
                <th className="text-left py-2 px-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-4 text-center text-gray-500">Carregando...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-4 text-center text-gray-500">Nenhum job</td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">
                      {job.status === 'sucesso' ? (
                        <Badge className="bg-green-100 text-green-800">✓ Sucesso</Badge>
                      ) : job.status === 'falha' ? (
                        <Badge className="bg-red-100 text-red-800">✗ Falha</Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800">{job.status}</Badge>
                      )}
                    </td>
                    <td className="py-2 px-2 text-xs">{job.acao || '-'}</td>
                    <td className="py-2 px-2 text-xs font-mono">{job.snapshot_id?.substring(0, 8)}...</td>
                    <td className="py-2 px-2 text-xs">{job.initiated_by}</td>
                    <td className="py-2 px-2 text-xs">{new Date(job.initiated_at).toLocaleString('pt-BR')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}