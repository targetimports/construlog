import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, Clock, Pause } from 'lucide-react';

export default function ProgressoObraFases({ obra_id }) {
  const { data: fases } = useQuery({
    queryKey: ['fases', obra_id],
    queryFn: () => base44.entities.Fase.filter({ obra_id })
  });

  const { data: marcos } = useQuery({
    queryKey: ['marcos', obra_id],
    queryFn: () => base44.entities.Marco.filter({ obra_id })
  });

  // Calcular métricas
  const metricas = {
    total: fases?.length || 0,
    concluidas: fases?.filter(f => f.status === 'concluida').length || 0,
    emProgresso: fases?.filter(f => f.status === 'em_progresso').length || 0,
    atrasadas: fases?.filter(f => f.status === 'atrasada').length || 0,
    progressoMedio: fases && fases.length > 0
      ? Math.round(fases.reduce((sum, f) => sum + (f.percentual_concluido || 0), 0) / fases.length)
      : 0
  };

  const marcosCriticos = marcos?.filter(m => m.criticidade === 'critica' && m.status !== 'concluido') || [];

  return (
    <div className="space-y-6">
      {/* ALERTAS CRÍTICOS */}
      {marcosCriticos.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-6 flex gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-red-900 mb-2">Marcos Críticos Vencidos</p>
              <div className="space-y-1">
                {marcosCriticos.map(m => (
                  <p key={m.id} className="text-sm text-red-800">
                    • <strong>{m.nome}</strong> - Vencido em {new Date(m.data_prevista).toLocaleDateString('pt-BR')}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-gray-600">Total de Fases</p>
            <p className="text-3xl font-bold text-gray-900">{metricas.total}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-xs text-green-700">Concluídas</p>
            <p className="text-3xl font-bold text-green-600">{metricas.concluidas}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-xs text-blue-700">Em Progresso</p>
            <p className="text-3xl font-bold text-blue-600">{metricas.emProgresso}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-xs text-red-700">Atrasadas</p>
            <p className="text-3xl font-bold text-red-600">{metricas.atrasadas}</p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-6">
            <p className="text-xs text-purple-700">Progresso Médio</p>
            <p className="text-3xl font-bold text-purple-600">{metricas.progressoMedio}%</p>
          </CardContent>
        </Card>
      </div>

      {/* PROGRESSO POR FASE */}
      <Card>
        <CardHeader>
          <CardTitle>Progresso por Fase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fases?.sort((a, b) => a.ordem - b.ordem).map((fase, idx) => (
            <div key={fase.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-1">
                  {fase.status === 'concluida' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {fase.status === 'atrasada' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                  {fase.status === 'em_progresso' && <Clock className="w-4 h-4 text-blue-600" />}
                  {fase.status === 'suspensa' && <Pause className="w-4 h-4 text-gray-600" />}
                  <span className="font-medium text-gray-900">{idx + 1}. {fase.nome}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{fase.percentual_concluido}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${
                    fase.status === 'concluida'
                      ? 'bg-green-500'
                      : fase.status === 'atrasada'
                      ? 'bg-red-500'
                      : 'bg-blue-500'
                  }`}
                  style={{ width: `${fase.percentual_concluido}%` }}
                />
              </div>
              <div className="text-xs text-gray-600 mt-1">
                {new Date(fase.data_inicio).toLocaleDateString('pt-BR')} a {new Date(fase.data_fim).toLocaleDateString('pt-BR')}
                {fase.orcamento_previsto > 0 && ` • Orçamento: R$ ${fase.orcamento_previsto.toFixed(2)}`}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* MARCOS PRINCIPAIS */}
      {marcos && marcos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Marcos Importantes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {marcos.sort((a, b) => new Date(a.data_prevista) - new Date(b.data_prevista)).map(marco => (
                <div
                  key={marco.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    marco.status === 'concluido'
                      ? 'border-l-green-500 bg-green-50'
                      : marco.status === 'atrasado'
                      ? 'border-l-red-500 bg-red-50'
                      : 'border-l-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">★ {marco.nome}</p>
                      <p className="text-sm text-gray-600 mt-1">{marco.descricao}</p>
                      <p className="text-xs text-gray-600 mt-2">
                        Previsto: {new Date(marco.data_prevista).toLocaleDateString('pt-BR')}
                        {marco.data_realizada && ` | Realizado: ${new Date(marco.data_realizada).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded font-semibold ${
                        marco.status === 'concluido'
                          ? 'bg-green-100 text-green-800'
                          : marco.status === 'atrasado'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {marco.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}