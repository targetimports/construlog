import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { base44 } from '@/api/base44Client';
import { AlertCircle, TrendingUp } from 'lucide-react';

export default function CurvaSChart({ obra_id, contrato_versao_id }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [obra_id, contrato_versao_id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await base44.functions.invoke('getCurvaSMedicao', {
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
  if (!data?.curva_data?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Curva S — Evolução Física</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-gray-500 py-12">
          Sem BMs aprovadas para análise
        </CardContent>
      </Card>
    );
  }

  const chartData = data.curva_data.map(item => ({
    ...item,
    data: new Date(item.data).toLocaleDateString('pt-BR'),
    planejado: data.planejado_hoje // Linha horizontal de referência
  }));

  const statusColor = data.status_desvio === 'ADIANTADO' ? 'text-green-600' : 
                      data.status_desvio === 'ATRASADO' ? 'text-red-600' : 'text-blue-600';

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-sm">Curva S — Evolução Física</CardTitle>
            <p className="text-xs text-gray-600 mt-1">Progresso real vs planejado</p>
          </div>
          <div className={`text-right text-sm font-semibold ${statusColor}`}>
            {data.status_desvio === 'ADIANTADO' ? 'Adiantado' :
             data.status_desvio === 'ATRASADO' ? 'Atrasado' : '✓ No Prazo'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 rounded p-3">
            <p className="text-xs text-gray-600">Real</p>
            <p className="text-lg font-bold text-blue-600">{data.percentual_real?.toFixed(1)}%</p>
          </div>
          <div className="bg-amber-50 rounded p-3">
            <p className="text-xs text-gray-600">Planejado</p>
            <p className="text-lg font-bold text-amber-600">{data.planejado_hoje?.toFixed(1)}%</p>
          </div>
          <div className={`rounded p-3 ${data.desvio_fisico > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-xs text-gray-600">Desvio</p>
            <p className={`text-lg font-bold ${data.desvio_fisico > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.desvio_fisico > 0 ? '+' : ''}{data.desvio_fisico?.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Gráfico */}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="numero_bm" tick={{ fontSize: 12 }} />
            <YAxis label={{ value: '% Conclusão', angle: -90, position: 'insideLeft' }} />
            <Tooltip 
              formatter={(value) => `${value.toFixed(1)}%`}
              contentStyle={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="percentual_acumulado" 
              stroke="#3b82f6" 
              name="Real (Acumulado)"
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Info */}
        {data.desvio_fisico < -10 && (
          <div className="flex gap-2 bg-red-50 border border-red-200 rounded p-3 text-sm">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="text-red-800">
              Obra {Math.abs(data.desvio_fisico).toFixed(1)}% atrasada. Recomenda-se ação corretiva.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}