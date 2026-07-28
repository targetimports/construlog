import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { DollarSign } from 'lucide-react';

export default function AnaliseComparativaChart({ obra_id, contrato_versao_id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [obra_id, contrato_versao_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await base44.functions.invoke('getAnaliseMedicaoComparativa', {
        obra_id,
        contrato_versao_id
      });
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="h-96 bg-gray-100 rounded animate-pulse" />;
  if (error) return <div className="text-red-600 text-sm">Erro: {error}</div>;
  if (!data?.periodos?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Análise Comparativa — Orçado vs Realizado</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-gray-500 py-12">
          Sem dados para análise
        </CardContent>
      </Card>
    );
  }

  const chartData = data.periodos.map(p => ({
    mes: p.mes,
    'Orçado (Período)': Math.round(p.orcado),
    'Realizado (Período)': Math.round(p.realizado),
    'Acum. Orçado': Math.round(p.acumulado_orcado),
    'Acum. Realizado': Math.round(p.acumulado_realizado)
  }));

  const formatBRL = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      notation: 'compact'
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Análise Comparativa — Orçado vs Realizado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded p-3">
            <p className="text-xs text-gray-600">Total Orçado</p>
            <p className="text-sm font-bold text-blue-600">{formatBRL(data.resumo.total_orcado)}</p>
          </div>
          <div className="bg-green-50 rounded p-3">
            <p className="text-xs text-gray-600">Total Realizado</p>
            <p className="text-sm font-bold text-green-600">{formatBRL(data.resumo.total_realizado)}</p>
          </div>
          <div className="bg-purple-50 rounded p-3">
            <p className="text-xs text-gray-600">Margem Restante</p>
            <p className="text-sm font-bold text-purple-600">{formatBRL(data.resumo.margem)}</p>
          </div>
          <div className="bg-amber-50 rounded p-3">
            <p className="text-xs text-gray-600">Eficiência</p>
            <p className="text-sm font-bold text-amber-600">{data.resumo.eficiencia?.toFixed(1)}%</p>
          </div>
        </div>

        {/* Gráfico Comparativo */}
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="left" label={{ value: 'Período (R$)', angle: -90, position: 'insideLeft' }} />
            <YAxis yAxisId="right" orientation="right" label={{ value: 'Acumulado (R$)', angle: 90, position: 'insideRight' }} />
            <Tooltip 
              formatter={(value) => formatBRL(value)}
              contentStyle={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="Orçado (Período)" fill="#3b82f6" />
            <Bar yAxisId="left" dataKey="Realizado (Período)" fill="#10b981" />
            <Line yAxisId="right" type="monotone" dataKey="Acum. Realizado" stroke="#ef4444" strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Tabela Resumo */}
        <div className="text-xs space-y-1 border-t pt-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Total de BMs:</span>
            <span className="font-semibold">{data.resumo.total_bms}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Saldo % do Orçamento:</span>
            <span className="font-semibold">{data.resumo.saldo_percentual?.toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}