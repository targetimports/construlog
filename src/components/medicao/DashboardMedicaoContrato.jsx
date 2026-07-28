import React, { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const num = (v) => Number(v) || 0;
const fmtBRL = (v) => num(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => (d ? new Date(String(d).length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('pt-BR') : '—');

const STATUS_CLS = {
  pendente: 'bg-amber-100 text-amber-700',
  em_analise: 'bg-yellow-100 text-yellow-800',
  aprovada: 'bg-green-100 text-green-800',
  rejeitada: 'bg-red-100 text-red-800',
};

export default function DashboardMedicaoContrato({ contratoId }) {
  const queryClient = useQueryClient();

  const { data: contrato } = useQuery({
    queryKey: ['contrato', contratoId],
    queryFn: () => base44.entities.Contrato.filter({ id: contratoId }).then((r) => r[0]),
    enabled: !!contratoId,
  });

  const { data: medicoes = [], isLoading } = useQuery({
    queryKey: ['medicoes-contrato', contratoId],
    queryFn: () => base44.entities.MedicaoContrato.filter({ contrato_id: contratoId }, '-data_medicao', 500),
    enabled: !!contratoId,
  });

  const aprovarMutation = useMutation({
    mutationFn: ({ medicaoId, status }) => base44.functions.invoke('aprovarMedicaoContrato', { medicaoId, status }),
    onSuccess: (_d, vars) => {
      toast.success(vars.status === 'rejeitada' ? 'Medição rejeitada' : 'Medição aprovada');
      queryClient.invalidateQueries({ queryKey: ['medicoes-contrato', contratoId] });
      queryClient.invalidateQueries({ queryKey: ['medicoes-contratos'] });
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey?.[0] || '').startsWith('medido-contratos') });
    },
    onError: (e) => toast.error(e.message),
  });

  const dados = useMemo(() => {
    const aprovadas = medicoes.filter((m) => String(m.status).toLowerCase() === 'aprovada');
    const totalMedido = aprovadas.reduce((acc, m) => acc + num(m.valor_medido ?? m.valor_total), 0);
    const valorContrato = num(contrato?.valor_total);
    const saldoDisponivel = valorContrato - totalMedido;
    const percentualExecucao = valorContrato > 0 ? ((totalMedido / valorContrato) * 100).toFixed(1) : '0.0';
    const grafico = [
      { nome: 'Medido', valor: totalMedido },
      { nome: 'Saldo', valor: Math.max(0, saldoDisponivel) },
    ];
    return { totalMedido, saldoDisponivel, percentualExecucao, grafico };
  }, [medicoes, contrato]);

  if (isLoading) return <div className="text-sm text-gray-500">Carregando medições...</div>;

  return (
    <div className="space-y-4 min-w-0">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="border-gray-200 min-w-0"><CardContent className="p-2 sm:p-4">
          <p className="text-xs text-gray-500">Execução</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-600">{dados.percentualExecucao}%</p>
          <div className="w-full bg-gray-200 rounded h-1 mt-2">
            <div className="bg-blue-600 h-1 rounded" style={{ width: `${Math.min(100, dados.percentualExecucao)}%` }} />
          </div>
        </CardContent></Card>
        <Card className="border-gray-200 min-w-0"><CardContent className="p-2 sm:p-4">
          <p className="text-xs text-gray-500">Total Medido</p>
          <p className="text-sm sm:text-lg font-bold text-emerald-600 tabular-nums break-words leading-tight">{fmtBRL(dados.totalMedido)}</p>
        </CardContent></Card>
        <Card className="border-gray-200 min-w-0"><CardContent className="p-2 sm:p-4">
          <p className="text-xs text-gray-500">Saldo</p>
          <p className={`text-sm sm:text-lg font-bold tabular-nums break-words leading-tight ${dados.saldoDisponivel < 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmtBRL(dados.saldoDisponivel)}</p>
        </CardContent></Card>
      </div>

      {/* Gráfico */}
      <Card className="border-gray-200 overflow-hidden">
        <CardHeader><CardTitle className="text-sm text-gray-700">Execução vs Saldo</CardTitle></CardHeader>
        <CardContent className="min-w-0 overflow-x-hidden">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dados.grafico}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => fmtBRL(value)} />
              <Bar dataKey="valor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Lista de medições */}
      <Card className="border-gray-200">
        <CardHeader><CardTitle className="text-sm text-gray-700">Medições ({medicoes.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {medicoes.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Nenhuma medição lançada para este contrato.</p>
          ) : (
            medicoes.map((m) => {
              const st = String(m.status).toLowerCase();
              return (
                <div key={m.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.titulo || 'Medição'} · {fmtData(m.data_medicao)}</p>
                    <p className="text-xs text-gray-500 tabular-nums">{fmtBRL(m.valor_medido ?? m.valor_total)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={`text-xs border-0 gap-1 ${STATUS_CLS[st] || 'bg-gray-100 text-gray-600'}`}>
                      {st === 'aprovada' ? <CheckCircle className="w-3 h-3" /> : st === 'rejeitada' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {m.status}
                    </Badge>
                    {st !== 'aprovada' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                        disabled={aprovarMutation.isPending}
                        onClick={() => aprovarMutation.mutate({ medicaoId: m.id, status: 'aprovada' })}>
                        {aprovarMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Aprovar'}
                      </Button>
                    )}
                    {st !== 'rejeitada' && st !== 'aprovada' && (
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                        disabled={aprovarMutation.isPending}
                        onClick={() => aprovarMutation.mutate({ medicaoId: m.id, status: 'rejeitada' })}>
                        Rejeitar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
