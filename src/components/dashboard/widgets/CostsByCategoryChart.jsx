import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const mockData = [
  { categoria: 'Materiais', custo: 125000 },
  { categoria: 'Mão de Obra', custo: 95000 },
  { categoria: 'Transporte', custo: 34000 },
  { categoria: 'Equipamento', custo: 28000 },
  { categoria: 'Serviços', custo: 18000 },
];

export default function CostsByCategoryChart({ config }) {
  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Custos por Categoria</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={mockData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="categoria" />
          <YAxis />
          <Tooltip formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
          <Bar dataKey="custo" fill="#8b5cf6" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}