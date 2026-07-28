import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ComparativoOrcadoRealizado({ orcamento, items, medicoes }) {
  const analise = useMemo(() => {
    const porEtapa = {};

    // Agrupar itens por etapa
    items.forEach(item => {
      const etapa = item.etapa || 'Geral';
      if (!porEtapa[etapa]) {
        porEtapa[etapa] = { orcado: 0, realizado: 0, items: [] };
      }
      porEtapa[etapa].orcado += item.valor_total || 0;
      porEtapa[etapa].items.push(item);
    });

    // Calcular realizado por etapa (baseado em medições)
    medicoes?.forEach(med => {
      med.itens?.forEach(item => {
        Object.keys(porEtapa).forEach(etapa => {
          const found = porEtapa[etapa].items.find(i => i.id === item.item_id);
          if (found) {
            porEtapa[etapa].realizado += item.valor_medido || 0;
          }
        });
      });
    });

    const chartData = Object.entries(porEtapa).map(([etapa, dados]) => ({
      etapa,
      orcado: dados.orcado,
      realizado: dados.realizado,
      variacao: dados.orcado - dados.realizado,
      percentualRealizado: dados.orcado > 0 ? ((dados.realizado / dados.orcado) * 100).toFixed(1) : 0
    }));

    const totalOrcado = items.reduce((acc, item) => acc + (item.valor_total || 0), 0);
    const totalRealizado = medicoes?.reduce((acc, med) => acc + (med.valor_medido || 0), 0) || 0;
    const variacaoTotal = totalOrcado - totalRealizado;
    const percentualConclusao = totalOrcado > 0 ? ((totalRealizado / totalOrcado) * 100).toFixed(1) : 0;

    return {
      chartData,
      totalOrcado,
      totalRealizado,
      variacaoTotal,
      percentualConclusao,
      deAcordo: Math.abs(variacaoTotal) <= (totalOrcado * 0.05),
      sobreOrcado: variacaoTotal < 0,
      subOrcado: variacaoTotal > 0
    };
  }, [items, medicoes]);

  return (
    <div className="space-y-6">
      {/* Resumo Total */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Valor Orçado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              R$ {analise.totalOrcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Valor Realizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              R$ {analise.totalRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-1">{analise.percentualConclusao}% do orçado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Variação Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              analise.sobreOrcado ? "text-red-600" : "text-green-600"
            )}>
              R$ {Math.abs(analise.variacaoTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {analise.sobreOrcado ? 'Sobre orçado' : 'Sob orçado'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Status</CardTitle>
          </CardHeader>
          <CardContent>
            {analise.deAcordo ? (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-600">De Acordo</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="font-semibold text-yellow-600">Atenção</span>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">Variação > 5%</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Comparativo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Orçado vs. Realizado por Etapa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analise.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="etapa" />
              <YAxis />
              <Tooltip 
                formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
              />
              <Legend />
              <Bar dataKey="orcado" fill="#3b82f6" name="Orçado" />
              <Bar dataKey="realizado" fill="#10b981" name="Realizado" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Análise Detalhada por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-700">Etapa</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Orçado</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Realizado</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-700">Variação</th>
                  <th className="text-center py-2 px-3 font-semibold text-gray-700">% Conclusão</th>
                </tr>
              </thead>
              <tbody>
                {analise.chartData.map((row) => (
                  <tr key={row.etapa} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium text-gray-900">{row.etapa}</td>
                    <td className="py-3 px-3 text-right text-gray-600">
                      R$ {row.orcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-600">
                      R$ {row.realizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={cn(
                      "py-3 px-3 text-right font-semibold",
                      row.variacao < 0 ? "text-red-600" : "text-green-600"
                    )}>
                      R$ {Math.abs(row.variacao).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-center text-gray-600">{row.percentualRealizado}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}