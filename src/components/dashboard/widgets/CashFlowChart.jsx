import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

const mockData = [
  { mes: 'Jan', entrada: 45000, saida: 32000 },
  { mes: 'Fev', entrada: 52000, saida: 38000 },
  { mes: 'Mar', entrada: 48000, saida: 35000 },
  { mes: 'Abr', entrada: 61000, saida: 42000 },
  { mes: 'Mai', entrada: 55000, saida: 40000 },
];

export default function CashFlowChart({ config }) {
  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Fluxo de Caixa</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={mockData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="mes" />
          <YAxis />
          <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
          <Line type="monotone" dataKey="entrada" stroke="#10b981" name="Entradas" strokeWidth={2} />
          <Line type="monotone" dataKey="saida" stroke="#ef4444" name="Saídas" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}