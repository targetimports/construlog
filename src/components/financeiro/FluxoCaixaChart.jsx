import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function FluxoCaixaChart({ contas }) {
  // Agrupar por mês
  const meses = {};
  
  contas.forEach(conta => {
    if (!conta.data_vencimento) return;
    const date = new Date(conta.data_vencimento);
    const mesAno = `${date.getMonth() + 1}/${date.getFullYear()}`;
    
    if (!meses[mesAno]) {
      meses[mesAno] = { mes: mesAno, receber: 0, pagar: 0 };
    }
    
    if (conta.tipo === 'receber') {
      meses[mesAno].receber += conta.valor || 0;
    } else {
      meses[mesAno].pagar += conta.valor || 0;
    }
  });

  const dados = Object.values(meses)
    .sort((a, b) => {
      const [mesA, anoA] = a.mes.split('/').map(Number);
      const [mesB, anoB] = b.mes.split('/').map(Number);
      return anoA - anoB || mesA - mesB;
    })
    .slice(-6); // Últimos 6 meses

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={dados}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="mes" stroke="#6B7280" />
        <YAxis stroke="#6B7280" />
        <Tooltip 
          contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '8px' }}
          labelStyle={{ color: '#1F2937' }}
          formatter={(value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        />
        <Legend />
        <Bar dataKey="receber" fill="#10B981" name="A Receber" radius={[4, 4, 0, 0]} />
        <Bar dataKey="pagar" fill="#EF4444" name="A Pagar" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}