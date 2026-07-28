import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Progress } from '@/components/ui/progress';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export default function CFFVisualizado({ items, medicoes, valorTotal }) {
  const cffData = useMemo(() => {
    const porMes = {};
    
    // Inicializar todos os meses
    for (let i = 1; i <= 12; i++) {
      porMes[i] = {
        mes: MESES[i - 1],
        mesNum: i,
        planejado: 0,
        realizado: 0,
        acumuladoPlanejado: 0,
        acumuladoRealizado: 0
      };
    }

    // Somar valores planejados por mês
    items?.forEach(item => {
      if (item.mes_previsto) {
        porMes[item.mes_previsto].planejado += item.valor_total || 0;
      }
    });

    // Somar valores realizados por mês
    medicoes?.forEach(med => {
      const dataMed = new Date(med.data_envio || med.periodo_fim);
      const mesMed = dataMed.getMonth() + 1;
      if (porMes[mesMed]) {
        porMes[mesMed].realizado += med.valor_medido || 0;
      }
    });

    // Calcular acumulados
    let acumPlan = 0, acumReal = 0;
    const chartData = Object.values(porMes).map(mes => {
      acumPlan += mes.planejado;
      acumReal += mes.realizado;
      return {
        ...mes,
        acumuladoPlanejado: acumPlan,
        acumuladoRealizado: acumReal,
        percentualPlanejado: ((acumPlan / valorTotal) * 100).toFixed(1),
        percentualRealizado: ((acumReal / valorTotal) * 100).toFixed(1)
      };
    });

    return chartData;
  }, [items, medicoes, valorTotal]);

  const totais = useMemo(() => {
    if (!cffData.length) return { planejado: 0, realizado: 0 };
    const ultimo = cffData[cffData.length - 1];
    return {
      planejado: ultimo.acumuladoPlanejado,
      realizado: ultimo.acumuladoRealizado,
      variacao: ultimo.acumuladoPlanejado - ultimo.acumuladoRealizado
    };
  }, [cffData]);

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Físico Planejado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="text-2xl font-bold text-blue-600">
                {totais.planejado > 0 ? ((totais.planejado / valorTotal) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-xs text-gray-500 mb-1">
                R$ {totais.planejado.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </div>
            </div>
            <Progress value={(totais.planejado / valorTotal) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Físico Realizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="text-2xl font-bold text-green-600">
                {totais.realizado > 0 ? ((totais.realizado / valorTotal) * 100).toFixed(1) : 0}%
              </div>
              <div className="text-xs text-gray-500 mb-1">
                R$ {totais.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </div>
            </div>
            <Progress value={(totais.realizado / valorTotal) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Variação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              totais.variacao > 0 ? "text-amber-600" : "text-green-600"
            )}>
              {totais.variacao > 0 ? '+' : ''}{((totais.variacao / valorTotal) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {totais.variacao > 0 ? 'Atrasado' : 'Adiantado'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico CFF */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Cronograma Físico-Financeiro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cffData}>
              <defs>
                <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip 
                formatter={(value) => `${value.toFixed(1)}%`}
                labelFormatter={(label) => `Acumulado: ${label}%`}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="percentualPlanejado" 
                stroke="#3b82f6" 
                fillOpacity={1}
                fill="url(#colorPlan)"
                name="Planejado (%)"
              />
              <Area 
                type="monotone" 
                dataKey="percentualRealizado" 
                stroke="#10b981" 
                fillOpacity={1}
                fill="url(#colorReal)"
                name="Realizado (%)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráfico Mensal */}
      <Card>
        <CardHeader>
          <CardTitle>Comparativo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={cffData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`} />
              <Legend />
              <Bar dataKey="planejado" fill="#3b82f6" name="Planejado" />
              <Bar dataKey="realizado" fill="#10b981" name="Realizado" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}