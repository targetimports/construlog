import React, { useMemo } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export default function CFFComAlertas({ cff, medicoes, alertas }) {
  const analise = useMemo(() => {
    if (!cff || !medicoes) return null;

    const periodos = cff.periodos || [];
    const dataGrafico = periodos.map(p => {
      const medicoesPerido = medicoes.filter(m => {
        const mData = new Date(m.data_medicao);
        return mData >= new Date(p.data_inicio) && mData <= new Date(p.data_fim);
      });

      const percentualPlanejado = p.percentual_acumulado || 0;
      const percentualRealizado = medicoesPerido.reduce((acc, m) => acc + (m.percentual_fisico_acumulado || 0), 0) / (medicoesPerido.length || 1);

      return {
        periodo: new Date(p.data_inicio).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        planejado: percentualPlanejado,
        realizado: percentualRealizado,
        desvio: percentualRealizado - percentualPlanejado
      };
    });

    const alertasAtivos = (alertas || []).filter(a => a.status === 'ativo');
    const alertasCriticos = alertasAtivos.filter(a => a.severidade === 'critica' || a.severidade === 'alta');

    return { dataGrafico, alertasAtivos, alertasCriticos };
  }, [cff, medicoes, alertas]);

  if (!analise) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">Dados CFF não disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const { dataGrafico, alertasAtivos, alertasCriticos } = analise;

  return (
    <div className="space-y-6">
      {/* Resumo Alertas */}
      {alertasAtivos.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-orange-900">
                <AlertTriangle className="w-4 h-4" /> Alertas Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">{alertasAtivos.length}</p>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-red-900">
                <AlertTriangle className="w-4 h-4" /> Críticos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{alertasCriticos.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gráfico CFF */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Cronograma Físico-Financeiro: Planejado vs Realizado</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dataGrafico}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
              <Legend />
              <Area type="monotone" dataKey="planejado" fill="#3b82f6" stroke="#1e40af" name="Planejado" opacity={0.6} />
              <Area type="monotone" dataKey="realizado" fill="#10b981" stroke="#047857" name="Realizado" opacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Alertas Detalhados */}
      {alertasAtivos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Alertas Identificados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {alertasAtivos.map((alerta) => (
                <div key={alerta.id} className={cn(
                  'border-l-4 p-3 rounded',
                  alerta.severidade === 'critica' ? 'border-l-red-600 bg-red-50' :
                  alerta.severidade === 'alta' ? 'border-l-orange-500 bg-orange-50' :
                  'border-l-yellow-500 bg-yellow-50'
                )}>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 text-sm capitalize">
                      {alerta.tipo_alerta.replace(/_/g, ' ')}
                    </h4>
                    <Badge className={cn(
                      alerta.severidade === 'critica' ? 'bg-red-100 text-red-800' :
                      alerta.severidade === 'alta' ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    )}>
                      {alerta.severidade}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-700 mb-2">{alerta.descricao}</p>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div className="bg-white rounded p-1.5">
                      <p className="text-gray-600">Planejado</p>
                      <p className="font-semibold">{alerta.percentual_planejado?.toFixed(1)}%</p>
                    </div>
                    <div className="bg-white rounded p-1.5">
                      <p className="text-gray-600">Realizado</p>
                      <p className="font-semibold">{alerta.percentual_realizado?.toFixed(1)}%</p>
                    </div>
                    <div className="bg-white rounded p-1.5">
                      <p className="text-gray-600">Desvio</p>
                      <p className={cn('font-semibold', alerta.desvio_percentual > 0 ? 'text-green-600' : 'text-red-600')}>
                        {alerta.desvio_percentual > 0 ? '+' : ''}{alerta.desvio_percentual?.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {alerta.impacto_financeiro && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <DollarSign className="w-3 h-3" />
                      <span>Impacto: <strong>R$ {(alerta.impacto_financeiro || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                    </div>
                  )}

                  {alerta.recomendacao && (
                    <p className="text-xs text-gray-600 mt-2 italic">{alerta.recomendacao}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}