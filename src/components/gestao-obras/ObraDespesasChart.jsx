import React from 'react';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = ['#EF4444', '#F97316', '#EAB308', '#84CC16', '#22C55E', '#06B6D4', '#0EA5E9', '#6366F1'];

export default function ObraDespesasChart({ despesasPorCategoria }) {
  const chartData = Object.entries(despesasPorCategoria).map(([cat, val]) => ({
    name: cat.replace(/_/g, ' ').toUpperCase(),
    value: val
  })).sort((a, b) => b.value - a.value);

  const total = chartData.reduce((a, c) => a + c.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Despesas por Categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resumo de Despesas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {chartData.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-xs font-semibold text-gray-700">{item.name}</span>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-900">{item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                <p className="text-xs text-gray-500">{((item.value / total) * 100).toFixed(1)}%</p>
              </div>
            </div>
          ))}
          <div className="border-t pt-2 mt-2 flex justify-between font-bold">
            <span>TOTAL</span>
            <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}