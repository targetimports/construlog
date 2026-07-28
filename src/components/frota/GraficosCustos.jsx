import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981', '#8B5CF6'];

export default function GraficosCustos({ custos }) {
  const totalGasto = useMemo(() => {
    return custos.reduce((acc, c) => acc + (c.valor || 0), 0);
  }, [custos]);

  const custosPorTipo = useMemo(() => {
    const tipos = {};
    custos.forEach(c => {
      tipos[c.tipo] = (tipos[c.tipo] || 0) + (c.valor || 0);
    });

    return Object.entries(tipos)
      .map(([tipo, valor]) => ({
        name: tipo.charAt(0).toUpperCase() + tipo.slice(1).replace(/_/g, ' '),
        value: valor
      }))
      .sort((a, b) => b.value - a.value);
  }, [custos]);

  const custosPorMes = useMemo(() => {
    const meses = {};
    custos.forEach(c => {
      const data = new Date(c.data_custo);
      const mes = `${data.getMonth() + 1}/${data.getFullYear()}`;
      meses[mes] = (meses[mes] || 0) + (c.valor || 0);
    });

    return Object.entries(meses)
      .sort((a, b) => {
        const [mesA, anoA] = a[0].split('/').map(Number);
        const [mesB, anoB] = b[0].split('/').map(Number);
        return anoA - anoB || mesA - mesB;
      })
      .slice(-6)
      .map(([mes, total]) => ({ mes, total }));
  }, [custos]);

  if (custos.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Total Gasto */}
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-sm text-gray-400 mb-2">Total Gasto</div>
              <div className="text-3xl font-bold text-amber-400">
                {totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custos por Tipo */}
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Distribuição por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {custosPorTipo.map((tipo, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">{tipo.name}</span>
                  <Badge className="bg-gray-700 text-gray-300">
                    {tipo.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Mensal */}
      {custosPorMes.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Custos últimos 6 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={custosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="mes" stroke="#9CA3AF" fontSize={12} />
                  <YAxis stroke="#9CA3AF" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px' }}
                    formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  />
                  <Bar dataKey="total" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pizza de tipos */}
      {custosPorTipo.length > 0 && (
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Proporção de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={custosPorTipo}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: R$ ${(value/1000).toFixed(0)}k`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {custosPorTipo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}