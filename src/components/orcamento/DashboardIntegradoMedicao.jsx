import React, { useMemo } from 'react';
import { TrendingUp, Calendar, DollarSign, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

export default function DashboardIntegradoMedicao({ orcamento, medicoes, previsao }) {
  const dashboard = useMemo(() => {
    if (!orcamento || !medicoes) return null;

    const valorTotal = orcamento.valor_total || 0;
    const percentualConcluido = previsao?.percentual_concluido || 0;
    const valorRealizado = (percentualConcluido / 100) * valorTotal;
    const valorRestante = valorTotal - valorRealizado;

    const dataGrafico = [];
    const medicoesOrdenadas = medicoes.sort((a, b) => new Date(a.data_envio) - new Date(b.data_envio));
    
    medicoesOrdenadas.forEach(m => {
      dataGrafico.push({
        data: new Date(m.data_envio).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
        percentualFisico: m.percentual_fisico_acumulado || 0,
        percentualFinanceiro: (m.percentual_fisico_acumulado * valorTotal) / 100 || 0
      });
    });

    return {
      valorTotal,
      valorRealizado,
      valorRestante,
      percentualConcluido,
      dataGrafico,
      diasRestantes: previsao?.dias_restantes_estimados || 0,
      ritmo: previsao?.ritmo_percentual_dia || 0,
      confiabilidade: previsao?.confiabilidade_previsao || 0
    };
  }, [orcamento, medicoes, previsao]);

  if (!dashboard) {
    return (
      <Card className="bg-gray-50">
        <CardContent className="py-8 text-center">
          <p className="text-gray-600">Dados de integração indisponíveis</p>
        </CardContent>
      </Card>
    );
  }

  const { valorTotal, valorRealizado, valorRestante, percentualConcluido, dataGrafico, diasRestantes, ritmo, confiabilidade } = dashboard;

  return (
    <div className="space-y-6">
      {/* Resumo Integrado */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600">Progresso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{percentualConcluido.toFixed(0)}%</p>
            <Progress value={percentualConcluido} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Realizado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-green-600">
              R$ {(valorRealizado / 1000).toFixed(0)}k
            </p>
            <p className="text-xs text-gray-500 mt-1">de R$ {(valorTotal / 1000).toFixed(0)}k</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Previsão
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-purple-600">{diasRestantes}</p>
            <p className="text-xs text-gray-500 mt-1">dias restantes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Ritmo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn("text-lg font-bold", ritmo > 0.5 ? "text-green-600" : "text-orange-600")}>
              {ritmo.toFixed(2)}%/dia
            </p>
            <Badge variant="outline" className="mt-2 text-xs">
              {confiabilidade.toFixed(0)}% confiança
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Integrado */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Evolução: Físico vs Financeiro</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dataGrafico}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="data" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'percentualFinanceiro') {
                    return ['R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 0 }), 'Financeiro'];
                  }
                  return [value.toFixed(1) + '%', 'Físico'];
                }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="percentualFisico" stroke="#3b82f6" name="Físico (%)" />
              <Line yAxisId="right" type="monotone" dataKey="percentualFinanceiro" stroke="#10b981" name="Financeiro (R$)" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Resumo Financeiro */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Realizado</p>
              <p className="text-2xl font-bold text-green-600">
                R$ {valorRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Restante</p>
              <p className="text-2xl font-bold text-orange-600">
                R$ {valorRestante.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Total</p>
              <p className="text-2xl font-bold text-gray-900">
                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}