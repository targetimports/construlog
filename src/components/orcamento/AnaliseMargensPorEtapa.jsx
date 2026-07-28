import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';

export default function AnaliseMargensPorEtapa({ items, medicoes }) {
  const analiseMargens = useMemo(() => {
    const porEtapa = {};

    // Agrupar por etapa
    items?.forEach(item => {
      const etapa = item.etapa || 'Geral';
      if (!porEtapa[etapa]) {
        porEtapa[etapa] = { 
          orcado: 0, 
          realizado: 0, 
          items: [],
          margem: 0,
          percentualMargem: 0 
        };
      }
      porEtapa[etapa].orcado += item.valor_total || 0;
      porEtapa[etapa].items.push(item);
    });

    // Calcular realizado
    medicoes?.forEach(med => {
      Object.keys(porEtapa).forEach(etapa => {
        const itemsEtapa = porEtapa[etapa].items;
        const valoresEtapa = med.itens?.reduce((acc, medItem) => {
          const found = itemsEtapa.find(i => i.id === medItem.item_id);
          return acc + (found ? medItem.valor_medido || 0 : 0);
        }, 0) || 0;
        porEtapa[etapa].realizado += valoresEtapa;
      });
    });

    // Calcular margens
    const chartData = Object.entries(porEtapa).map(([etapa, dados]) => {
      const margem = dados.orcado - dados.realizado;
      const percentualMargem = dados.orcado > 0 ? (margem / dados.orcado) * 100 : 0;
      
      return {
        etapa,
        orcado: dados.orcado,
        realizado: dados.realizado,
        margem: margem,
        percentualMargem: percentualMargem,
        risco: percentualMargem < 10 ? 'critico' : percentualMargem < 20 ? 'alto' : 'normal'
      };
    });

    const margemTotal = porEtapa ? 
      Object.values(porEtapa).reduce((acc, d) => acc + (d.orcado - d.realizado), 0) : 0;
    const orcadoTotal = Object.values(porEtapa).reduce((acc, d) => acc + d.orcado, 0);
    const percentualMargemTotal = orcadoTotal > 0 ? (margemTotal / orcadoTotal) * 100 : 0;

    return { chartData, margemTotal, percentualMargemTotal, orcadoTotal };
  }, [items, medicoes]);

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Orçamento Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              R$ {analiseMargens.orcadoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Margem Disponível</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn(
              "text-2xl font-bold",
              analiseMargens.margemTotal > 0 ? "text-green-600" : "text-red-600"
            )}>
              R$ {analiseMargens.margemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {analiseMargens.percentualMargemTotal.toFixed(1)}% do orçado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Status Geral</CardTitle>
          </CardHeader>
          <CardContent>
            {analiseMargens.percentualMargemTotal > 20 ? (
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-600">Seguro</span>
              </div>
            ) : analiseMargens.percentualMargemTotal > 10 ? (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="font-semibold text-yellow-600">Atenção</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-red-600">Crítico</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Margens */}
      <Card>
        <CardHeader>
          <CardTitle>Análise de Margens por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analiseMargens.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="etapa" />
              <YAxis />
              <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
              <Legend />
              <Bar dataKey="percentualMargem" fill="#10b981" name="Margem %" radius={[8, 8, 0, 0]}>
                {analiseMargens.chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={entry.risco === 'critico' ? '#ef4444' : entry.risco === 'alto' ? '#f59e0b' : '#10b981'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analiseMargens.chartData.map((row) => (
              <div key={row.etapa} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">{row.etapa}</h4>
                    <p className="text-sm text-gray-500">
                      Orçado: R$ {row.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | 
                      Realizado: R$ {row.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-semibold",
                    row.risco === 'critico' ? "bg-red-100 text-red-700" :
                    row.risco === 'alto' ? "bg-yellow-100 text-yellow-700" :
                    "bg-green-100 text-green-700"
                  )}>
                    {row.percentualMargem.toFixed(1)}% margem
                  </div>
                </div>
                <Progress 
                  value={100 - row.percentualMargem} 
                  className="h-2"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}