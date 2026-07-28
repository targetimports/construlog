import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CurvaS({ medicoes = [], valorOrcado = 0 }) {
  // Preparar dados para a Curva S
  const dadosCurvaS = medicoes
    .filter(m => m.status === 'aprovada')
    .sort((a, b) => new Date(a.periodo_fim) - new Date(b.periodo_fim))
    .map(medicao => ({
      data: new Date(medicao.periodo_fim).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      planejado: valorOrcado * (medicao.percentual_fisico_acumulado / 100),
      realizado: medicao.valor_acumulado || 0,
      percentual: medicao.percentual_fisico_acumulado || 0
    }));

  // Adicionar linha de planejamento ideal (linear)
  if (dadosCurvaS.length > 0) {
    const incrementoPlanejado = valorOrcado / dadosCurvaS.length;
    dadosCurvaS.forEach((ponto, idx) => {
      ponto.planejado = incrementoPlanejado * (idx + 1);
    });
  }

  // Calcular indicadores
  const ultimaMedicao = dadosCurvaS[dadosCurvaS.length - 1] || {};
  const valorPlanejado = ultimaMedicao.planejado || 0;
  const valorRealizado = ultimaMedicao.realizado || 0;
  const variacao = valorRealizado - valorPlanejado;
  const variacaoPercentual = valorPlanejado > 0 ? (variacao / valorPlanejado) * 100 : 0;

  const status = variacaoPercentual > 10 ? 'alerta' : variacaoPercentual < -5 ? 'otimo' : 'normal';

  return (
    <div className="space-y-6">
      {/* Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Planejado Acumulado</p>
                <p className="text-white text-2xl font-bold">
                  {valorPlanejado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Realizado Acumulado</p>
                <p className="text-white text-2xl font-bold">
                  {valorRealizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border",
          status === 'alerta' ? "bg-red-500/5 border-red-500/20" :
          status === 'otimo' ? "bg-emerald-500/5 border-emerald-500/20" :
          "bg-gray-900 border-gray-800"
        )}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Variação</p>
                <p className={cn(
                  "text-2xl font-bold",
                  status === 'alerta' ? "text-red-400" :
                  status === 'otimo' ? "text-emerald-400" :
                  "text-white"
                )}>
                  {variacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className={cn(
                  "text-xs font-semibold mt-1",
                  status === 'alerta' ? "text-red-400" :
                  status === 'otimo' ? "text-emerald-400" :
                  "text-gray-400"
                )}>
                  {variacaoPercentual > 0 ? '+' : ''}{variacaoPercentual.toFixed(1)}%
                </p>
              </div>
              <div className={cn(
                "p-3 rounded-lg",
                status === 'alerta' ? "bg-red-500/10" :
                status === 'otimo' ? "bg-emerald-500/10" :
                "bg-gray-800"
              )}>
                {status === 'alerta' ? (
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                ) : status === 'otimo' ? (
                  <TrendingDown className="w-6 h-6 text-emerald-500" />
                ) : (
                  <TrendingUp className="w-6 h-6 text-gray-500" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Curva S */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Curva S - Execução Físico-Financeira</CardTitle>
        </CardHeader>
        <CardContent>
          {dadosCurvaS.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-gray-500">Nenhuma medição aprovada para exibir</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={dadosCurvaS}>
                <defs>
                  <linearGradient id="colorPlanejado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRealizado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="data" 
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#9ca3af"
                  style={{ fontSize: '12px' }}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="planejado"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorPlanejado)"
                  name="Planejado"
                />
                <Area
                  type="monotone"
                  dataKey="realizado"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRealizado)"
                  name="Realizado"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}