import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function GraficoVolumeFornecedor({ requisicoes = [] }) {
  const dados = useMemo(() => {
    if (!requisicoes.length) return [];

    const fornecedorMap = new Map();

    requisicoes.forEach(req => {
      // Tentar obter fornecedor de diferentes campos
      const fornecedor = req.fornecedor_nome || req.fornecedor || 'Sem Fornecedor';
      
      if (!fornecedorMap.has(fornecedor)) {
        fornecedorMap.set(fornecedor, { 
          fornecedor: fornecedor, 
          valor: 0, 
          quantidade: 0 
        });
      }
      
      const item = fornecedorMap.get(fornecedor);
      item.valor += req.valor_total_estimado || 0;
      item.quantidade += 1;
    });

    // Ordenar por valor descendente e pegar top 10
    return Array.from(fornecedorMap.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [requisicoes]);

  const valorTotal = dados.reduce((sum, item) => sum + item.valor, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume de Compras por Fornecedor (Top 10)</CardTitle>
      </CardHeader>
      <CardContent>
        {dados.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-500">
            Nenhum dado disponível
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart 
              data={dados} 
              margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                type="number"
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
                tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}K`}
              />
              <YAxis 
                dataKey="fornecedor" 
                type="category"
                width={140}
                stroke="#6b7280"
                style={{ fontSize: '11px' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '12px'
                }}
                formatter={(value, name) => {
                  if (name === 'valor') {
                    return [
                      `R$ ${(value / 1000).toFixed(1)}K`,
                      'Valor Total'
                    ];
                  }
                  return [value, name];
                }}
              />
              <Legend />
              <Bar 
                dataKey="valor" 
                fill="#8b5cf6" 
                name="Valor Total"
                radius={[0, 8, 8, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Tabela resumida */}
        <div className="mt-6 pt-6 border-t overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3 text-gray-600 font-medium">Fornecedor</th>
                <th className="text-right py-2 px-3 text-gray-600 font-medium">Valor</th>
                <th className="text-right py-2 px-3 text-gray-600 font-medium">Quantidade</th>
                <th className="text-right py-2 px-3 text-gray-600 font-medium">% do Total</th>
              </tr>
            </thead>
            <tbody>
              {dados.map((item, idx) => (
                <tr key={idx} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-900">{item.fornecedor}</td>
                  <td className="text-right py-2 px-3 text-gray-900 font-medium">
                    R$ {(item.valor / 1000).toFixed(1)}K
                  </td>
                  <td className="text-right py-2 px-3 text-gray-600">
                    {item.quantidade}
                  </td>
                  <td className="text-right py-2 px-3 text-gray-600 font-medium">
                    {valorTotal > 0 ? ((item.valor / valorTotal) * 100).toFixed(1) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}